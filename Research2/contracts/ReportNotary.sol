// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ReportNotary {
    mapping(uint256 => bytes32) private reportHashes;

    event ReportHashStored(uint256 indexed reportId, bytes32 pdfHash);

    function storeReportHash(uint256 reportId, bytes32 pdfHash) external returns (bool) {
        reportHashes[reportId] = pdfHash;
        emit ReportHashStored(reportId, pdfHash);
        return true;
    }

    function getReportHash(uint256 reportId) external view returns (bytes32) {
        return reportHashes[reportId];
    }
}

