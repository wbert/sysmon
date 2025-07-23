export const bytesFmt = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB`
    : n >= 1e6 ? `${(n / 1e6).toFixed(2)} MB`
      : n >= 1e3 ? `${(n / 1e3).toFixed(2)} KB`
        : `${n} B`;

export const bpsFmt = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(2)} Gbps`
    : b >= 1e6 ? `${(b / 1e6).toFixed(2)} Mbps`
      : b >= 1e3 ? `${(b / 1e3).toFixed(2)} Kbps`
        : `${b.toFixed(0)} bps`;

