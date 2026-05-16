import React from "react";
import { PointTable as PointTableType, PointTableEntry } from "../types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy, TrendingUp, ChevronRight } from "lucide-react";

interface PointTableProps {
  table: PointTableType;
}

export const PointTable: React.FC<PointTableProps> = ({ table }) => {
  // Sort entries by points then NRR
  const sortedEntries = [...table.entries].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });

  return (
    <Card className="bg-slate-900/50 backdrop-blur-md border-white/5 shadow-2xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/20 p-2 rounded-xl">
            <TrendingUp className="w-5 h-5 text-amber-500" />
          </div>
          <CardTitle className="text-xl font-black text-white italic tracking-tight uppercase">Standings</CardTitle>
        </div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">{sortedEntries.length} Teams Competing</div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-[10px] font-black text-slate-300 uppercase italic">Pos</TableHead>
              <TableHead className="text-[10px] font-black text-slate-300 uppercase italic">Team</TableHead>
              <TableHead className="text-[10px] font-black text-slate-300 uppercase italic text-center">P</TableHead>
              <TableHead className="text-[10px] font-black text-emerald-400 uppercase italic text-center">W</TableHead>
              <TableHead className="text-[10px] font-black text-red-400 uppercase italic text-center">L</TableHead>
              <TableHead className="text-[10px] font-black text-slate-300 uppercase italic text-center">NRR</TableHead>
              <TableHead className="text-[10px] font-black text-indigo-300 uppercase italic text-right pr-6">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEntries.map((entry, index) => (
              <TableRow key={entry.teamId} className="border-white/5 group hover:bg-white/5 transition-colors">
                <TableCell className="font-mono text-xs text-slate-500 font-bold pr-0">
                  {index + 1 < 10 ? `0${index + 1}` : index + 1}
                </TableCell>
                <TableCell className="font-bold text-white uppercase italic tracking-tighter">
                  <div className="flex items-center gap-2">
                    {index < 2 && <Trophy className={`w-3 h-3 ${index === 0 ? 'text-amber-400 fill-amber-400/20' : 'text-slate-300'}`} />}
                    {entry.teamName}
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono text-slate-400 text-sm">{entry.played}</TableCell>
                <TableCell className="text-center font-mono text-emerald-400 font-bold text-sm">{entry.won}</TableCell>
                <TableCell className="text-center font-mono text-red-400/50 text-sm">{entry.lost}</TableCell>
                <TableCell className="text-center font-mono text-slate-500 text-[10px]">{entry.nrr.toFixed(3)}</TableCell>
                <TableCell className="text-right pr-6">
                  <span className="bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded-lg font-black font-mono text-sm border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                    {entry.points}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
