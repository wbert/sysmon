import os
import time
import psutil
import pathlib
import socket
from datetime import datetime, timezone
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ALLOW_ORIGINS: list[str] = ["*"]
    WS_INTERVAL: float = 2.0
    TOP_N_PROCS: int = 5
    MONITOR_MODE: str = "auto"  # auto | host | container

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


# -------- host/container detection ----------
def _running_in_docker() -> bool:
    try:
        if pathlib.Path("/.dockerenv").exists():
            return True
        with open("/proc/1/cgroup", "r", errors="ignore") as f:
            txt = f.read()
        return "docker" in txt or "kubepods" in txt
    except Exception:
        return False


def monitor_source() -> str:
    mode = get_settings().MONITOR_MODE.lower()
    if mode == "host":
        return "host"
    if mode == "container":
        return "container"
    # auto
    return "container" if _running_in_docker() else "host"


# -------- helpers ----------
_last_net = {"ts": 0.0, "bytes_sent": 0, "bytes_recv": 0}


def _net_rates(now: float, io: psutil._common.snetio) -> dict:
    global _last_net
    prev = _last_net
    if prev["ts"] == 0:
        rate = {"up_bps": 0.0, "down_bps": 0.0}
    else:
        dt = now - prev["ts"]
        rate = {
            "up_bps": (io.bytes_sent - prev["bytes_sent"]) * 8 / dt,
            "down_bps": (io.bytes_recv - prev["bytes_recv"]) * 8 / dt,
        }
    _last_net = {"ts": now, "bytes_sent": io.bytes_sent, "bytes_recv": io.bytes_recv}
    return rate


def _top_processes(n: int):
    procs = []
    for p in psutil.process_iter(
        ["pid", "name", "username", "cpu_percent", "memory_percent"]
    ):
        info = p.info
        info["cpu_percent"] = float(info.get("cpu_percent") or 0.0)
        info["memory_percent"] = float(info.get("memory_percent") or 0.0)
        procs.append(info)
    procs.sort(key=lambda x: (x["cpu_percent"], x["memory_percent"]), reverse=True)
    return procs[:n]


def _safe_temperatures() -> dict:
    if hasattr(psutil, "sensors_temperatures"):
        try:
            t = psutil.sensors_temperatures(fahrenheit=False)  # type: ignore[attr-defined]
            return {k: [x._asdict() for x in v] for k, v in t.items()}
        except Exception:
            pass
    return {}


def _safe_fans() -> dict:
    if hasattr(psutil, "sensors_fans"):
        try:
            f = psutil.sensors_fans()  # type: ignore[attr-defined]
            return {k: [x._asdict() for x in v] for k, v in f.items()}
        except Exception:
            pass
    return {}


def _safe_battery():
    if hasattr(psutil, "sensors_battery"):
        try:
            b = psutil.sensors_battery()  # type: ignore[attr-defined]
            return b._asdict() if b else None
        except Exception:
            pass
    return None


# -------- public ----------
def get_snapshot() -> dict:
    now = time.time()
    cpu_percent = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    net_io = psutil.net_io_counters()
    net_rate = _net_rates(now, net_io)

    disks = {
        p.mountpoint: psutil.disk_usage(p.mountpoint)._asdict()
        for p in psutil.disk_partitions(all=False)
    }

    return {
        "source": monitor_source(),  # NEW
        "machine": socket.gethostname(),
        "now_iso": datetime.now(timezone.utc).isoformat(),
        "cpu_percent": cpu_percent,
        "cpu_cores": psutil.cpu_count(logical=True),
        "load_avg": os.getloadavg() if hasattr(os, "getloadavg") else None,
        "mem": mem._asdict(),
        "swap": swap._asdict(),
        "temps": _safe_temperatures(),
        "fans": _safe_fans(),
        "battery": _safe_battery(),
        "disk": disks,
        "net_io": net_io._asdict(),
        "net_rate": net_rate,
        "boot_time": psutil.boot_time(),
        "top_procs": _top_processes(get_settings().TOP_N_PROCS),
    }
