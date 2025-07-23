import { useEffect, useRef, useState } from "react";
import {
  Card, CardHeader, CardTitle, CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity, HardDrive, Network, BatteryCharging } from "lucide-react";
import { bytesFmt, bpsFmt } from "../lib/format";

type DiskInfo = { total: number; used: number; free: number; percent: number };
type Proc = { pid: number; name: string; username: string; cpu_percent: number; memory_percent: number };

type Stats = {
  cpu_percent: number;
  cpu_cores: number;
  load_avg: [number, number, number] | null;
  mem: { total: number; used: number; percent: number };
  swap: { total: number; used: number; percent: number };
  temps: Record<string, any[]>;
  fans: Record<string, any[]>;
  battery: { percent: number; secsleft: number; power_plugged: boolean } | null;
  disk: Record<string, DiskInfo>;
  net_io: { bytes_sent: number; bytes_recv: number; packets_sent: number; packets_recv: number };
  net_rate: { up_bps: number; down_bps: number };
  boot_time: number;
  top_procs: Proc[];
  machine: string;
  now_iso: string;
  source: string;
};


export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const history = useRef<{ t: number; cpu: number; ram: number }[]>([]);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/stats`);
    ws.onmessage = e => {
      const data: Stats = JSON.parse(e.data);
      setStats(data);
      history.current.push({ t: Date.now(), cpu: data.cpu_percent, ram: data.mem.percent });
      if (history.current.length > 120) history.current.shift();
    };
    return () => ws.close();
  }, []);

  if (!stats) return <p className="p-6">Loading…</p>;

  const memUsedGB = stats.mem.used / 1e9;
  const memTotalGB = stats.mem.total / 1e9;
  const swapUsedGB = stats.swap.used / 1e9;
  const swapTotalGB = stats.swap.total / 1e9;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">System Monitor</h1>
      <p className="text-sm text-muted-foreground">
        {stats.source} • {stats.machine} • {new Date(stats.now_iso).toLocaleString()}
      </p>
      {/* Top stat cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cpu_percent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{stats.cpu_cores} cores</p>
            <Progress value={stats.cpu_percent} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Memory</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mem.percent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {memUsedGB.toFixed(2)} / {memTotalGB.toFixed(2)} GB
            </p>
            <Progress value={stats.mem.percent} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Swap</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.swap.percent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {swapUsedGB.toFixed(2)} / {swapTotalGB.toFixed(2)} GB
            </p>
            <Progress value={stats.swap.percent} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Load Avg (1/5/15m)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats.load_avg ? (
              <div className="text-sm space-x-2">
                <span>{stats.load_avg[0].toFixed(2)}</span>
                <span>{stats.load_avg[1].toFixed(2)}</span>
                <span>{stats.load_avg[2].toFixed(2)}</span>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">N/A</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Battery & Network */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BatteryCharging className="h-4 w-4" /> Battery
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {stats.battery ? (
              <>
                <div className="text-2xl font-bold">{stats.battery.percent}%</div>
                <p className="text-xs text-muted-foreground">
                  Plugged: {stats.battery.power_plugged ? "Yes" : "No"} •
                  {` ${Math.floor(stats.battery.secsleft / 3600)}h ${Math.floor((stats.battery.secsleft % 3600) / 60)}m left`}
                </p>
                <Progress value={stats.battery.percent} className="mt-3" />
              </>
            ) : (
              <p className="text-muted-foreground">No battery info</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Network className="h-4 w-4" /> Network
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Up: {bpsFmt(stats.net_rate.up_bps)}</div>
            <div>Down: {bpsFmt(stats.net_rate.down_bps)}</div>
            <Separator className="my-2" />
            <div>Total Sent: {bytesFmt(stats.net_io.bytes_sent)}</div>
            <div>Total Recv: {bytesFmt(stats.net_io.bytes_recv)}</div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* CPU/RAM trend */}
      <Card className="h-72">
        <CardHeader>
          <CardTitle className="text-sm font-medium">CPU / RAM Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history.current}>
              <XAxis
                dataKey="t"
                tickFormatter={(t) => new Date(t).toLocaleTimeString()}
                tick={{ fontSize: 10 }}
              />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip
                labelFormatter={(t) => new Date(t).toLocaleTimeString()}
              />
              <Line type="monotone" dataKey="cpu" strokeWidth={2} dot={false} name="CPU %" />
              <Line type="monotone" dataKey="ram" strokeWidth={2} dot={false} name="RAM %" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Separator />

      {/* Disks */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Disks
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Mount</th>
                <th className="py-2 pr-4">Used</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">% Used</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.disk).map(([mount, d]) => (
                <tr key={mount} className="border-b last:border-none">
                  <td className="py-2 pr-4">{mount}</td>
                  <td className="py-2 pr-4">{bytesFmt(d.used)}</td>
                  <td className="py-2 pr-4">{bytesFmt(d.total)}</td>
                  <td className="py-2 pr-4 w-44">
                    <div className="flex items-center gap-2">
                      <span>{d.percent}%</span>
                      <Progress value={d.percent} className="h-2 flex-1" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Separator />

      {/* Top processes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top Processes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">PID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">% CPU</th>
                <th className="py-2 pr-4">% MEM</th>
              </tr>
            </thead>
            <tbody>
              {stats.top_procs.map((p) => (
                <tr key={p.pid} className="border-b last:border-none">
                  <td className="py-2 pr-4">{p.pid}</td>
                  <td className="py-2 pr-4">{p.name}</td>
                  <td className="py-2 pr-4">{p.username}</td>
                  <td className="py-2 pr-4">{p.cpu_percent.toFixed(1)}</td>
                  <td className="py-2 pr-4">{p.memory_percent.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

