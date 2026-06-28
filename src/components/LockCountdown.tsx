"use client";
import { useEffect, useState } from "react";

interface LockCountdownProps {
  lockInstantISO: string; // ISO string
}

export default function LockCountdown({ lockInstantISO }: LockCountdownProps) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(lockInstantISO).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Locked");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lockInstantISO]);

  return <span className="text-xs text-gray-500">Locks in {remaining}</span>;
}
