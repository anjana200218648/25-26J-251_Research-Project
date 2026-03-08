import hashlib
import json
import logging
from pathlib import Path
from typing import Any, Optional, Dict

from models import db, Report
from config import (
    BLOCKCHAIN_ENABLED,
    BLOCKCHAIN_NETWORK,
    BLOCKCHAIN_RPC_URL,
    BLOCKCHAIN_PRIVATE_KEY,
    BLOCKCHAIN_FROM_ADDRESS,
    BLOCKCHAIN_CONTRACT_ADDRESS,
    BLOCKCHAIN_CHAIN_ID,
    CONTRACT_ABI_PATH,
)

logger = logging.getLogger(__name__)


def compute_file_sha256(file_path: str | Path, chunk_size: int = 8192) -> str:
    """
    Compute SHA256 hash for a file (hex string, lowercase, no 0x prefix).
    """
    file_path = Path(file_path)
    h = hashlib.sha256()
    with file_path.open("rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_abi(abi_path: str | Path = CONTRACT_ABI_PATH) -> list[dict]:
    abi_path = Path(abi_path)
    if not abi_path.exists():
        raise FileNotFoundError(f"Contract ABI not found: {abi_path}")
    with abi_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _get_web3_and_contract(abi_path: str | Path = CONTRACT_ABI_PATH):
    """
    Web3 v7-compatible client + contract loader.
    """
    try:
        from web3 import Web3
        from web3.middleware import ExtraDataToPOAMiddleware
    except Exception as e:
        raise RuntimeError("web3 is not installed. Install with: pip install web3") from e

    if not BLOCKCHAIN_RPC_URL or not BLOCKCHAIN_CONTRACT_ADDRESS:
        raise RuntimeError(
            f"Missing RPC URL or contract address for network '{BLOCKCHAIN_NETWORK}'. "
            f"Set {BLOCKCHAIN_NETWORK.upper()}_RPC_URL and {BLOCKCHAIN_NETWORK.upper()}_CONTRACT_ADDRESS (or corresponding vars)."
        )

    w3 = Web3(Web3.HTTPProvider(BLOCKCHAIN_RPC_URL))
    # Web3 v7 PoA compatibility middleware (safe on many chains/providers).
    # Docs: inject at layer=0.
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

    if not w3.is_connected():
        raise RuntimeError(f"Failed to connect to RPC for network '{BLOCKCHAIN_NETWORK}'.")

    abi = _load_abi(abi_path)
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(BLOCKCHAIN_CONTRACT_ADDRESS),
        abi=abi,
    )
    return w3, contract


def store_hash_on_chain(
    report_id: int,
    pdf_hash_hex: str,
    abi_path: str | Path = CONTRACT_ABI_PATH,
    timeout_seconds: int = 120,
) -> Dict[str, Any]:
    """
    Stores report hash in the configured smart contract.

    Assumes Solidity contract exposes:
      storeReportHash(uint256 reportId, bytes32 pdfHash)
    """
    if not BLOCKCHAIN_ENABLED:
        return {"skipped": True, "reason": "BLOCKCHAIN_ENABLED=0"}

    w3, contract = _get_web3_and_contract(abi_path)

    pdf_hash_hex = (pdf_hash_hex or "").lower()
    if pdf_hash_hex.startswith("0x"):
        pdf_hash_hex = pdf_hash_hex[2:]
    if len(pdf_hash_hex) != 64:
        raise ValueError("pdf_hash_hex must be 64 hex characters (SHA256).")

    pdf_hash_bytes32 = bytes.fromhex(pdf_hash_hex)

    from web3 import Web3  # type: ignore

    # Ganache usually exposes funded, unlocked accounts via RPC.
    # If no FROM_ADDRESS is provided, default to the first RPC account.
    if BLOCKCHAIN_FROM_ADDRESS:
        from_address = Web3.to_checksum_address(BLOCKCHAIN_FROM_ADDRESS)
    else:
        try:
            accounts = list(w3.eth.accounts or [])
        except Exception:
            accounts = []
        if not accounts:
            raise RuntimeError(
                f"Missing signing address for network '{BLOCKCHAIN_NETWORK}'. "
                f"Set {BLOCKCHAIN_NETWORK.upper()}_FROM_ADDRESS."
            )
        from_address = Web3.to_checksum_address(accounts[0])

    nonce = w3.eth.get_transaction_count(from_address)

    tx_params: Dict[str, Any] = {
        "from": from_address,
        "nonce": nonce,
        # Prefer node-reported chain id to avoid env mismatches (common on Ganache).
        "chainId": int(getattr(w3.eth, "chain_id", None) or BLOCKCHAIN_CHAIN_ID),
        "gas": 300000,
    }

    # Prefer EIP-1559 fees if supported by the node/provider
    try:
        latest_block = w3.eth.get_block("latest")
        base_fee = latest_block.get("baseFeePerGas")
        if base_fee is not None:
            priority_fee = getattr(w3.eth, "max_priority_fee", None)
            if callable(priority_fee):
                priority_fee = priority_fee()
            if priority_fee is None:
                # fallback heuristic (1 gwei)
                priority_fee = w3.to_wei(1, "gwei")
            tx_params["maxPriorityFeePerGas"] = int(priority_fee)
            tx_params["maxFeePerGas"] = int(base_fee) * 2 + int(priority_fee)
        else:
            tx_params["gasPrice"] = w3.eth.gas_price
    except Exception:
        tx_params["gasPrice"] = w3.eth.gas_price

    fn = contract.functions.storeReportHash(int(report_id), pdf_hash_bytes32)

    # If we have a private key, sign locally.
    # Otherwise (common for Ganache), ask the node to sign/send from an unlocked account.
    if BLOCKCHAIN_PRIVATE_KEY:
        # Optional sanity check: private key should match from_address
        try:
            derived = w3.eth.account.from_key(BLOCKCHAIN_PRIVATE_KEY).address
            if Web3.to_checksum_address(derived) != from_address:
                logger.warning(
                    "FROM_ADDRESS does not match PRIVATE_KEY derived address "
                    "(from=%s derived=%s)",
                    from_address,
                    Web3.to_checksum_address(derived),
                )
        except Exception:
            pass

        tx = fn.build_transaction(tx_params)
        signed = w3.eth.account.sign_transaction(tx, private_key=BLOCKCHAIN_PRIVATE_KEY)
        # Web3 v7 SignedTransaction uses `raw_transaction`
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    else:
        # `transact` delegates signing to the RPC node (requires unlocked account).
        tx_hash = fn.transact(tx_params)

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout_seconds)

    return {
        "tx_hash": tx_hash.hex(),
        "status": int(receipt.status),
        "block_number": int(receipt.blockNumber),
    }


def get_hash_from_chain(
    report_id: int,
    abi_path: str | Path = CONTRACT_ABI_PATH,
) -> Optional[str]:
    """
    Reads report hash from Sepolia contract.

    Assumes Solidity contract exposes:
      getReportHash(uint256 reportId) returns (bytes32)
    """
    if not BLOCKCHAIN_ENABLED:
        return None

    w3, contract = _get_web3_and_contract(abi_path)
    value = contract.functions.getReportHash(int(report_id)).call()

    if isinstance(value, (bytes, bytearray)):
        return value.hex()

    # Fallback: try to_hex conversion
    try:
        from web3 import Web3  # type: ignore
        hx = Web3.to_hex(value)
        return hx[2:] if hx.startswith("0x") else hx
    except Exception:
        return None


def notarize_pdf_report(
    report: Report,
    pdf_path: str | Path,
    abi_path: str | Path = CONTRACT_ABI_PATH,
) -> Dict[str, Any]:
    """
    Step 7–9:
      - hash PDF
      - save hash to DB
      - store hash on chain (if enabled and configured)
      - save tx metadata

    Always returns a dict with:
      pdf_hash, blockchain_tx_hash, blockchain_block_number, blockchain_status, error
    """
    result = {
        "pdf_hash": None,
        "blockchain_tx_hash": None,
        "blockchain_block_number": None,
        "blockchain_status": "SKIPPED" if not BLOCKCHAIN_ENABLED else "PENDING",
        "error": None,
    }

    try:
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        pdf_hash = compute_file_sha256(pdf_path)
        result["pdf_hash"] = pdf_hash

        # Save hash to DB even if blockchain is disabled
        report.pdf_hash = pdf_hash
        report.blockchain_status = result["blockchain_status"]
        db.session.add(report)
        db.session.commit()

        if not BLOCKCHAIN_ENABLED:
            result["error"] = "Blockchain disabled"
            report.blockchain_status = "SKIPPED"
            db.session.add(report)
            db.session.commit()
            return result

        # Store on chain
        bc = store_hash_on_chain(report.id, pdf_hash, abi_path=abi_path)
        if bc.get("skipped"):
            report.blockchain_status = "SKIPPED"
            result["blockchain_status"] = "SKIPPED"
            result["error"] = bc.get("reason") or "Blockchain skipped"
        else:
            report.blockchain_tx_hash = bc.get("tx_hash")
            report.blockchain_block_number = bc.get("block_number")
            report.blockchain_status = "CONFIRMED" if bc.get("status") == 1 else "FAILED"

            result["blockchain_tx_hash"] = report.blockchain_tx_hash
            result["blockchain_block_number"] = report.blockchain_block_number
            result["blockchain_status"] = report.blockchain_status

        db.session.add(report)
        db.session.commit()
        return result

    except Exception as e:
        logger.error("Notarization failed for report %s: %s", getattr(report, "id", None), e, exc_info=True)
        result["blockchain_status"] = "FAILED" if BLOCKCHAIN_ENABLED else "SKIPPED"
        result["error"] = str(e)
        try:
            report.blockchain_status = result["blockchain_status"]
            db.session.add(report)
            db.session.commit()
        except Exception:
            db.session.rollback()
        return result


def verify_pdf_against_blockchain(
    report_id: int,
    pdf_path: str | Path,
    abi_path: str | Path = CONTRACT_ABI_PATH,
) -> Dict[str, Any]:
    """
    Internal verification:
      local PDF hash (outputs/<filename>) vs DB pdf_hash vs blockchain hash.

    Always returns all expected keys (with N/A/SKIPPED defaults if missing).
    """
    report = Report.query.get(report_id)
    if report is None:
        raise ValueError("Report not found")

    out = {
        "matches_db": False,
        "matches_blockchain": False,
        "local_hash": "N/A",
        "db_hash": getattr(report, "pdf_hash", None) or "N/A",
        "blockchain_hash": "N/A",
        "blockchain_status": getattr(report, "blockchain_status", None) or "SKIPPED",
        "blockchain_tx_hash": getattr(report, "blockchain_tx_hash", None) or "N/A",
        "blockchain_block_number": getattr(report, "blockchain_block_number", None) if getattr(report, "blockchain_block_number", None) is not None else "N/A",
    }

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        out["error"] = "PDF file not found for this report"
        return out

    local_hash = compute_file_sha256(pdf_path)
    out["local_hash"] = local_hash

    db_hash = getattr(report, "pdf_hash", None)
    if db_hash:
        out["db_hash"] = db_hash
        out["matches_db"] = (local_hash.lower() == str(db_hash).lower())

    # Blockchain is optional; still return local+db results even if disabled
    if not BLOCKCHAIN_ENABLED:
        out["blockchain_status"] = "SKIPPED"
        out["blockchain_hash"] = "N/A"
        out["error"] = "Blockchain notarization not available"
        return out

    try:
        chain_hash = get_hash_from_chain(report_id, abi_path=abi_path)
        if chain_hash:
            out["blockchain_hash"] = chain_hash
            out["matches_blockchain"] = (local_hash.lower() == chain_hash.lower())
        else:
            out["blockchain_hash"] = "N/A"
            out["error"] = "Blockchain hash not available"
    except Exception as e:
        out["blockchain_hash"] = "N/A"
        out["error"] = str(e)

    return out

