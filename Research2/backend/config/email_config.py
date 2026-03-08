import os

EMAIL_CONFIG = {
    "smtp_server": os.getenv("SMTP_SERVER", "smtp.gmail.com"),
    "smtp_port": int(os.getenv("SMTP_PORT", 587)),
    "sender_email": os.getenv("SENDER_EMAIL", "weerahasindu@gmail.com"),
    "sender_password": os.getenv("SENDER_PASSWORD", "coztnmptydujszxn"),
    "authorized_emails": {
        "psychologist": os.getenv("PSYCHOLOGIST_EMAIL", "yasi20000422@gmail.com"),
        "cert": os.getenv("CERT_EMAIL", "hasinduweerakkodi453@gmail.com"),
        "police": os.getenv("POLICE_EMAIL", "deranatv30@gmail.com"),
    }
}

EMAIL_SETTINGS = {
    "use_tls": True,
    "timeout": 30,
    "max_retries": 3
}
