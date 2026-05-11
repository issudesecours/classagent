"""Loguru configuration. Imported once from main.py at startup."""

import os
import sys

from loguru import logger


def configure_logging() -> None:
    logger.remove()
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    logger.add(
        sys.stderr,
        level=level,
        colorize=True,
        format=(
            "<dim>{time:HH:mm:ss}</dim> "
            "<level>{level: <7}</level> "
            "<cyan>{extra[tag]: <12}</cyan> "
            "<level>{message}</level>"
        ),
        filter=lambda r: r["extra"].setdefault("tag", "app") is not None,
    )
