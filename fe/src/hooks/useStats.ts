import { useEffect, useRef, useState } from "react";

export type Stats = {
  cpu_percent: number;
  cpu_cores: number;
  mem: { total: number; used: number; percent: number;[k: string]: any };
  swap: any;
  disk: Record<string, { total: number; used: number; free: number; percent: number }>;
  net_io: { bytes_sent: number; bytes_recv: number;[k: string]: any };
  boot_time: number;
};

export function useStats(wsUrl = "ws://localhost:8000/ws/stats") {
  const [stats, setStats] = useState<Stats | null>(null);
  const history = useRef<{ t: number; cpu: number; ram: number }[]>([]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (e) => {
      const data: Stats = JSON.parse(e.data);
      setStats(data);
      history.current.push({
        t: Date.now(),
        cpu: data.cpu_percent,
        ram: data.mem.percent,
      });
      if (history.current.length > 100) history.current.shift();
    };
    return () => ws.close();
  }, [wsUrl]);

  return { stats, history: history.current };
}
