import React from "react";
import { Match, MatchPlayerStats, Team } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, Target, Zap, Waves as Wave } from "lucide-react";
import { motion } from "framer-motion";

interface PlayerPerformanceProps {
  userUid: string;
  matches: Match[];
  teams: Team[];
}

export const PlayerPerformance: React.FC<PlayerPerformanceProps> = ({ userUid, matches, teams }) => {
  // Find player's team
  const playerTeam = teams.find(t => t.playerIds?.includes(userUid));

  // Filter matches involving the player or their team
  const playerMatches = matches.filter(m => 
    (m.innings[1]?.playerStats?.[userUid]) || 
    (m.innings[2]?.playerStats?.[userUid]) ||
    (playerTeam && (m.team1Id === playerTeam.id || m.team2Id === playerTeam.id))
  ).sort((a, b) => {
    // Sort by status (live first) then maybe by timestamp if available (though not explicitly in Match type yet)
    if (a.status === "live" && b.status !== "live") return -1;
    if (a.status !== "live" && b.status === "live") return 1;
    return 0;
  });

  const getPlayerStatsForMatch = (match: Match): MatchPlayerStats => {
    return match.innings[1]?.playerStats?.[userUid] || match.innings[2]?.playerStats?.[userUid] || {
      uid: userUid,
      name: "",
      runs: 0,
      balls: 0,
      wickets: 0,
      fours: 0,
      sixes: 0,
      bowlingRuns: 0,
      bowlingBalls: 0,
      overs: 0,
      isOut: false
    } as MatchPlayerStats;
  };

  if (playerMatches.length === 0) {
    return (
      <Card className="bg-slate-900 border-white/5 p-8 rounded-[2rem] text-center border-dashed border-2">
        <Wave className="w-12 h-12 text-slate-700 mx-auto mb-4" />
        <p className="text-slate-500 font-medium italic">No match participation recorded yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black italic text-indigo-400 uppercase tracking-tighter">Match Progress</h3>
        <Badge className="bg-indigo-600/10 text-indigo-400 border-none font-black italic uppercase text-[10px]">
          {playerMatches.length} Matches
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {playerMatches.map((match) => {
          const stats = getPlayerStatsForMatch(match);
          const isLive = match.status === "live";
          const strikeRate = stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : "0.0";
          const economy = stats.bowlingBalls > 0 ? ((stats.bowlingRuns / (stats.bowlingBalls / 6))).toFixed(2) : "0.00";

          return (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              key={match.id}
            >
              <Card className={`bg-slate-900 border-white/5 overflow-hidden group hover:border-indigo-500/50 transition-all ${isLive ? 'ring-1 ring-red-500/30' : ''}`}>
                <div className="p-3 bg-white/5 border-b border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[120px]">
                      {match.name}
                    </span>
                    {isLive && <Badge className="bg-red-600 animate-pulse text-[8px] h-4 font-black italic py-0 px-2">LIVE</Badge>}
                  </div>
                  <span className="text-[9px] font-black text-indigo-400 italic">
                    {isLive ? "In Progress" : "Completed"}
                  </span>
                </div>
                
                <CardContent className="p-4 space-y-4">
                  {/* Performance Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Batting Stats */}
                    <div className="space-y-2 bg-indigo-950/20 p-3 rounded-2xl border border-indigo-500/10">
                      <div className="flex items-center gap-1.5">
                        <Target className="w-3 h-3 text-amber-400" />
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Batting</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <span className="text-xl font-black text-white italic font-mono">{stats.runs}</span>
                          <span className="text-[10px] text-slate-500 font-bold ml-1">({stats.balls})</span>
                        </div>
                        <div className="text-right">
                          <p className="text-[7px] font-black text-slate-600 uppercase">S/R</p>
                          <p className="text-[10px] font-black text-indigo-400 font-mono italic">{strikeRate}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <div className="flex flex-col">
                           <span className="text-[6px] font-black text-slate-600 uppercase">4s</span>
                           <span className="text-[9px] font-bold text-white">{stats.fours}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[6px] font-black text-slate-600 uppercase">6s</span>
                           <span className="text-[9px] font-bold text-white">{stats.sixes}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bowling Stats */}
                    <div className="space-y-2 bg-emerald-950/20 p-3 rounded-2xl border border-emerald-500/10">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Bowling</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <span className="text-xl font-black text-white italic font-mono">{stats.wickets}</span>
                          <span className="text-[10px] text-slate-500 font-bold ml-1">Wkts</span>
                        </div>
                        <div className="text-right">
                          <p className="text-[7px] font-black text-slate-600 uppercase">Econ</p>
                          <p className="text-[10px] font-black text-emerald-400 font-mono italic">{economy}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <div className="flex flex-col">
                           <span className="text-[6px] font-black text-slate-600 uppercase">Overs</span>
                           <span className="text-[9px] font-bold text-white font-mono">{stats.overs || Math.floor(stats.bowlingBalls / 6) + '.' + (stats.bowlingBalls % 6)}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[6px] font-black text-slate-600 uppercase">Runs</span>
                           <span className="text-[9px] font-bold text-white">{(stats as any).bowlingRuns || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {match.winnerId && !isLive && (
                    <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                         <Trophy className="w-3 h-3 text-indigo-400" />
                         <span className="text-[8px] font-black text-slate-500 uppercase">Status</span>
                      </div>
                      <span className={`text-[9px] font-black italic ${match.winnerId === "tie" ? "text-amber-400" : "text-emerald-400"}`}>
                        {match.winnerId === "tie" ? "Result: Tie" : "Result: Finished"}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
