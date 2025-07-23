import { useEffect, useRef, useState } from "react";
import {
  Card, CardHeader, CardTitle, CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Activity, HardDrive, Network, BatteryCharging, Thermometer, Fan, Cpu, MemoryStick,
} from "lucide-react";
import { bytesFmt, bpsFmt } from "@/lib/format";

type DiskInfo = { total: number; used: number; free: number; percent: number };
type Proc = { pid: number; name: string; username: string; cpu_percent: number; memory_percent: number };

type Stats = {
  source: string;
  machine: string;
  now_iso: string;
  cpu_percent: number;
  cpu_cores: number;
  load_avg: [number, number, number] | null;
  mem: { total: number; used: number; percent: number };
  swap: { total: number; used: number; percent: number };
  temps: Record<string, Array<{ label: string | null; current: number; high?: number | null; critical?: number | null }>>;
  fans: Record<string, Array<{ label: string | null; current: number }>>;
  battery: { percent: number; secsleft: number; power_plugged: boolean } | null;
  disk: Record<string, DiskInfo>;
  net_io: { bytes_sent: number; bytes_recv: number; packets_sent: number; packets_recv: number };
  net_rate: { up_bps: number; down_bps: number };
  boot_time: number;
  top_procs: Proc[];
};

const bytesToGB = (n: number) => n / 1e9;
const tempPct = (cur: number, high?: number | null) =>
  high && high > 0 ? (cur / high) * 100 : Math.min(cur, 100); // fallback

const niceLabel = (lbl: string | null, idx: number) => lbl && lbl.trim() ? lbl : `sensor_${idx}`;

const HIDE_DISKS = ["/etc/hosts", "/etc/hostname", "/etc/resolv.conf"];


export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const history = useRef<{ t: number; cpu: number; ram: number }[]>([]);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/stats`);
    ws.onmessage = (e) => {
      const data: Stats = JSON.parse(e.data);
      setStats(data);
      history.current.push({ t: Date.now(), cpu: data.cpu_percent, ram: data.mem.percent });
      if (history.current.length > 120) history.current.shift();
    };
    return () => ws.close();
  }, []);

  if (!stats) return <p className="p-6">Loading…</p>;

  const hasTemps = Object.keys(stats.temps).length > 0;
  const hasFans = Object.keys(stats.fans).length > 0;

  const memUsedGB = bytesToGB(stats.mem.used).toFixed(2);
  const memTotalGB = bytesToGB(stats.mem.total).toFixed(2);
  const swapUsedGB = bytesToGB(stats.swap.used).toFixed(2);
  const swapTotalGB = bytesToGB(stats.swap.total).toFixed(2);

  const disks = Object.entries(stats.disk).filter(([m]) => !HIDE_DISKS.includes(m));

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
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Cpu className="h-4 w-4" /> CPU
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cpu_percent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{stats.cpu_cores} cores</p>
            <Progress value={stats.cpu_percent} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <MemoryStick className="h-4 w-4" /> Memory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mem.percent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {memUsedGB} / {memTotalGB} GB
            </p>
            <Progress value={stats.mem.percent} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Activity className="h-4 w-4" /> Swap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.swap.percent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {swapUsedGB} / {swapTotalGB} GB
            </p>
            <Progress value={stats.swap.percent} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Load Avg (1/5/15m)</CardTitle>
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

      {/* Temps & Fans */}
      {(hasTemps || hasFans) && (
        <>
          <Separator />
          <div className={`grid gap-4 ${hasTemps && hasFans ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
            {hasTemps && (
              <Card className={!hasFans ? "md:col-span-2" : ""}>
                <CardHeader className="flex items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Thermometer className="h-4 w-4" /> Temperatures
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {Object.entries(stats.temps).map(([chip, arr]) => (
                    <div key={chip}>
                      <p className="font-medium mb-1 text-muted-foreground">{chip}</p>
                      {arr.map((t, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[minmax(7rem,auto)_4.5rem_auto] items-center gap-2 py-1"
                        >
                          <span className="truncate">{niceLabel(t.label, i)}</span>
                          <span className="text-right tabular-nums">{t.current.toFixed(1)}°C</span>
                          <div className="flex items-center gap-2">
                            {t.high && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                / {t.high.toFixed(1)}°C
                              </span>
                            )}
                            <Progress className="h-2 flex-1" value={tempPct(t.current, t.high)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {hasFans && (
              <Card className={!hasTemps ? "md:col-span-2" : ""}>
                <CardHeader className="flex items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Fan className="h-4 w-4" /> Fans
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {Object.entries(stats.fans).map(([chip, arr]) => (
                    <div key={chip}>
                      <p className="font-medium mb-1 text-muted-foreground">{chip}</p>
                      {arr.map((f, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[minmax(7rem,auto)_auto] items-center gap-2 py-1"
                        >
                          <span className="truncate">{niceLabel(f.label, i)}</span>
                          <span className="tabular-nums">{f.current} RPM</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      <Separator />

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
                  Plugged: {stats.battery.power_plugged ? "Yes" : "No"} •{" "}
                  {`${Math.floor(stats.battery.secsleft / 3600)}h ${Math.floor((stats.battery.secsleft % 3600) / 60)}m left`}
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
              <Tooltip labelFormatter={(t) => new Date(t).toLocaleTimeString()} />
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
                <th className="py-2 pr-4 text-right">Used</th>
                <th className="py-2 pr-4 text-right">Total</th>
                <th className="py-2 pr-4 w-44 text-right">% Used</th>
              </tr>
            </thead>
            <tbody>
              {disks.map(([mount, d]) => (
                <tr key={mount} className="border-b last:border-none">
                  <td className="py-2 pr-4">{mount}</td>
                  <td className="py-2 pr-4 text-right">{bytesFmt(d.used)}</td>
                  <td className="py-2 pr-4 text-right">{bytesFmt(d.total)}</td>
                  <td className="py-2 pr-4 w-44">
                    <div className="flex items-center gap-2">
                      <span className="min-w-10 text-right">{d.percent}%</span>
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
                <th className="py-2 pr-4 text-right">% CPU</th>
                <th className="py-2 pr-4 text-right">% MEM</th>
              </tr>
            </thead>
            <tbody>
              {stats.top_procs.map((p) => (
                <tr key={p.pid} className="border-b last:border-none">
                  <td className="py-2 pr-4">{p.pid}</td>
                  <td className="py-2 pr-4">{p.name}</td>
                  <td className="py-2 pr-4">{p.username}</td>
                  <td className="py-2 pr-4 text-right">{p.cpu_percent.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right">{p.memory_percent.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

