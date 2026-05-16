import React, { useMemo, useState } from "react";
import { UserProfile, Team } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Crown, Target, Zap, Waves, User, X, Info, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerIDCard } from "./PlayerIDCard";

interface LeaderboardProps {
  players: UserProfile[];
  teams: Team[];
}

export const Leaderboard = ({ players, teams }: LeaderboardProps) => {
  const [activeSegment, setActiveSegment] = useState<"teams" | "players">("players");
  const [playerSubTab, setPlayerSubTab] = useState<"batsmen" | "bowlers" | "allrounders">("batsmen");
  const [selectedPlayer, setSelectedPlayer] = useState<UserProfile | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const rankedTeams = useMemo(() => {
    return [...teams]
      .sort((a, b) => {
        const winsA = a.stats?.won || 0;
        const winsB = b.stats?.won || 0;
        if (winsB !== winsA) return winsB - winsA;
        
        const playedA = a.stats?.matches || 0;
        const playedB = b.stats?.matches || 0;
        if (playedB !== playedA) return playedB - playedA;
        
        const winRateA = playedA > 0 ? (winsA / playedA) : 0;
        const winRateB = playedB > 0 ? (winsB / playedB) : 0;
        return winRateB - winRateA;
      });
  }, [teams]);

  const legacyNames = ["Virat", "Babar", "Buttler", "Shaheen", "Rashid"];
  const livePlayers = useMemo(() => {
    return players.filter(p => !legacyNames.some(name => p.displayName.toLowerCase().includes(name.toLowerCase())));
  }, [players]);

  const rankedBatsmen = useMemo(() => {
    return [...livePlayers]
      .filter(p => (p.stats?.matches || 0) > 0 && (p.stats?.runs || 0) > 0)
      .sort((a, b) => (b.stats?.runs || 0) - (a.stats?.runs || 0));
  }, [livePlayers]);

  const rankedBowlers = useMemo(() => {
    return [...livePlayers]
      .filter(p => (p.stats?.matches || 0) > 0 && (p.stats?.wickets || 0) > 0)
      .sort((a, b) => (b.stats?.wickets || 0) - (a.stats?.wickets || 0));
  }, [livePlayers]);

  const rankedAllRounders = useMemo(() => {
    return [...livePlayers]
      .filter(p => (p.stats?.matches || 0) > 0 && ((p.stats?.runs || 0) > 0 || (p.stats?.wickets || 0) > 0))
      .map(p => ({
        ...p,
        performanceScore: (p.stats?.runs || 0) + (p.stats?.wickets || 0) * 20
      }))
      .sort((a, b) => b.performanceScore - a.performanceScore);
  }, [livePlayers]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />;
    if (index === 1) return <Medal className="w-5 h-5 text-slate-300" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-[10px] font-black font-mono text-slate-500">#{index + 1}</span>;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-indigo-500" />
          <h2 className="text-4xl font-black italic tracking-tighter uppercase">Hall of Fame</h2>
        </div>
        <p className="text-slate-500 text-xs font-medium italic max-w-lg">
          The ultimate rankings based on career performance across all matches and tournaments. 
          Rising to the top is hard, staying there is legendary.
        </p>
      </div>

      <div className="flex gap-2 bg-slate-900/50 p-1 rounded-2xl border border-white/5 w-fit">
        <button
          onClick={() => setActiveSegment("players")}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all",
            activeSegment === "players" ? "bg-indigo-600 text-white shadow-xl" : "text-slate-500 hover:text-white"
          )}
        >
          Players
        </button>
        <button
          onClick={() => setActiveSegment("teams")}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all",
            activeSegment === "teams" ? "bg-indigo-600 text-white shadow-xl" : "text-slate-500 hover:text-white"
          )}
        >
          Teams
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSegment === "players" ? (
          <motion.div
            key="players-leaderboard"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex gap-4 border-b border-white/5 pb-4">
              <button 
                onClick={() => setPlayerSubTab("batsmen")}
                className={cn("text-xs font-black italic uppercase transition-all flex items-center gap-2", playerSubTab === "batsmen" ? "text-indigo-400" : "text-slate-500")}
              >
                <Zap className="w-3 h-3" /> Top Batsmen
              </button>
              <button 
                onClick={() => setPlayerSubTab("bowlers")}
                className={cn("text-xs font-black italic uppercase transition-all flex items-center gap-2", playerSubTab === "bowlers" ? "text-emerald-400" : "text-slate-500")}
              >
                <Target className="w-3 h-3" /> Top Bowlers
              </button>
              <button 
                onClick={() => setPlayerSubTab("allrounders")}
                className={cn("text-xs font-black italic uppercase transition-all flex items-center gap-2", playerSubTab === "allrounders" ? "text-amber-400" : "text-slate-500")}
              >
                <Waves className="w-3 h-3" /> Legends (All-Round)
              </button>
            </div>

            <div className="grid gap-3">
              {(playerSubTab === "batsmen" ? rankedBatsmen : playerSubTab === "bowlers" ? rankedBowlers : rankedAllRounders).slice(0, 50).map((player, i) => (
                <div 
                  key={player.uid}
                  onClick={() => setSelectedPlayer(player)}
                  className="group flex items-center gap-4 bg-slate-900/30 border border-white/5 p-4 rounded-2xl hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="w-10 flex justify-center">
                    {getRankIcon(i)}
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center font-black text-indigo-400 text-lg italic overflow-hidden">
                    {player.photoURL ? <img src={player.photoURL} className="w-full h-full object-cover" /> : player.displayName[0]}
                  </div>

                  <div className="flex-1">
                    <h4 className="text-sm font-black italic text-white uppercase">{player.displayName}</h4>
                    <div className="flex gap-3 items-center">
                       <span className="text-[10px] font-mono text-slate-500">ID: {player.playerUniqueId}</span>
                       <Badge variant="outline" className="bg-white/5 border-white/5 text-[8px] font-black uppercase text-indigo-400 py-0 h-4">
                         {player.specialization}
                       </Badge>
                    </div>
                  </div>

                  <div className="text-right">
                    {playerSubTab === "batsmen" && (
                      <div className="flex flex-col">
                        <span className="text-lg font-black italic text-indigo-400 font-mono leading-none">{player.stats?.runs}</span>
                        <span className="text-[9px] font-black text-slate-600 uppercase">Runs</span>
                      </div>
                    )}
                    {playerSubTab === "bowlers" && (
                      <div className="flex flex-col">
                        <span className="text-lg font-black italic text-emerald-400 font-mono leading-none">{player.stats?.wickets}</span>
                        <span className="text-[9px] font-black text-slate-600 uppercase">Wickets</span>
                      </div>
                    )}
                    {playerSubTab === "allrounders" && (
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-600 uppercase">Runs</span>
                          <span className="text-xs font-black italic text-white font-mono">{player.stats?.runs}</span>
                        </div>
                        <div className="flex flex-col border-l border-white/10 pl-4">
                          <span className="text-[9px] font-black text-slate-600 uppercase">Wickets</span>
                          <span className="text-xs font-black italic text-white font-mono">{player.stats?.wickets}</span>
                        </div>
                        <div className="flex flex-col border-l border-white/10 pl-4">
                          <span className="text-[9px] font-black text-indigo-400 uppercase">Score</span>
                          <span className="text-sm font-black italic text-indigo-400 font-mono">{(player as any).performanceScore}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(playerSubTab === "batsmen" ? rankedBatsmen : playerSubTab === "bowlers" ? rankedBowlers : rankedAllRounders).length === 0 && (
                <div className="py-20 text-center space-y-4">
                   <User className="w-12 h-12 text-slate-800 mx-auto" />
                   <p className="text-slate-500 text-sm font-medium italic">Competition hasn't started yet. Score some runs to appear here!</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="teams-leaderboard"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="grid gap-3">
              {rankedTeams.slice(0, 50).map((team, i) => (
                <div 
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className="group flex items-center gap-4 bg-slate-900/30 border border-white/5 p-4 rounded-2xl hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="w-10 flex justify-center">
                    {getRankIcon(i)}
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-600/20 flex items-center justify-center font-black text-indigo-400 text-lg italic">
                    {team.name[0]}
                  </div>

                  <div className="flex-1">
                    <h4 className="text-sm font-black italic text-white uppercase">{team.name}</h4>
                    <div className="flex gap-3 items-center">
                       <span className="text-[10px] font-mono text-slate-500">{team.teamId}</span>
                       <Badge variant="outline" className="bg-white/5 border-white/5 text-[8px] font-black uppercase text-slate-400 py-0 h-4">
                         {team.type}
                       </Badge>
                    </div>
                  </div>

                  <div className="flex gap-8 items-center">
                    <div className="flex flex-col text-center">
                      <span className="text-[9px] font-black text-slate-600 uppercase">Played</span>
                      <span className="text-xs font-black italic text-white font-mono">{team.stats?.matches || 0}</span>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-[9px] font-black text-emerald-600 uppercase">Won</span>
                      <span className="text-lg font-black italic text-emerald-400 font-mono leading-none">{team.stats?.won || 0}</span>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-[9px] font-black text-amber-600 uppercase">Win %</span>
                      <span className="text-xs font-black italic text-amber-400 font-mono">
                        {team.stats?.matches ? ((team.stats.won / team.stats.matches) * 100).toFixed(1) : "0"}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {rankedTeams.length === 0 && (
                 <div className="py-20 text-center space-y-4">
                    <Shield className="w-12 h-12 text-slate-800 mx-auto" />
                    <p className="text-slate-500 text-sm font-medium italic">No teams have been created in the system yet.</p>
                 </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPlayer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg"
            >
              <button 
                onClick={() => setSelectedPlayer(null)}
                className="absolute -top-12 right-0 text-white/50 hover:text-white transition-colors bg-white/10 p-2 rounded-full backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>
              <PlayerIDCard player={selectedPlayer} />
              <div className="mt-4 text-center">
                <p className="text-[10px] font-black italic text-slate-500 uppercase tracking-widest">Tap outside to close profile</p>
              </div>
            </motion.div>
            <div className="absolute inset-0 -z-10" onClick={() => setSelectedPlayer(null)} />
          </div>
        )}

        {selectedTeam && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-slate-950 rounded-[2.5rem] border-4 border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-900/20 via-slate-950 to-black" />
                <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-[90px]" />
              </div>

              <div className="relative p-8 space-y-8 z-10">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">{selectedTeam.name}</h3>
                    <Badge variant="outline" className="bg-indigo-600/20 border-indigo-600/30 text-indigo-400 font-black italic text-[10px] uppercase">{selectedTeam.type} Team</Badge>
                  </div>
                  <button 
                    onClick={() => setSelectedTeam(null)}
                    className="text-white/20 hover:text-white transition-colors"
                  >
                    <X className="w-8 h-8" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/5 p-6 rounded-3xl space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block font-mono">Captain</span>
                    <p className="text-xl font-black italic text-white uppercase">
                      {players.find(p => p.uid === selectedTeam.captainId)?.displayName || "N/A"}
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-6 rounded-3xl space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block font-mono">Manager</span>
                    <p className="text-xl font-black italic text-white uppercase truncate">
                      {players.find(p => p.uid === selectedTeam.managerUid)?.displayName || "System"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <TeamStatBox label="Matches" value={selectedTeam.stats?.matches || 0} icon={<Star className="w-3 h-3" />} />
                  <TeamStatBox label="Won" value={selectedTeam.stats?.won || 0} color="text-emerald-400" />
                  <TeamStatBox label="Lost" value={(selectedTeam.stats?.matches || 0) - (selectedTeam.stats?.won || 0)} color="text-red-400" />
                  <TeamStatBox label="Win %" value={selectedTeam.stats?.matches ? ((selectedTeam.stats.won / selectedTeam.stats.matches) * 100).toFixed(1) + "%" : "0%"} highlight />
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between text-slate-500">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase italic">{selectedTeam.playerIds.length} Players in Squad</span>
                    </div>
                    <span className="text-[10px] font-mono uppercase">Reference: {selectedTeam.id.slice(0, 8)}</span>
                  </div>
                </div>
              </div>

              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rotate-45 translate-x-16 -translate-y-16 border-l border-white/10 pointer-events-none" />
            </motion.div>
            <div className="absolute inset-0 -z-10" onClick={() => setSelectedTeam(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TeamStatBox = ({ label, value, icon, color = "text-white", highlight }: { label: string, value: string | number, icon?: React.ReactNode, color?: string, highlight?: boolean }) => (
  <div className={cn(
    "bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-all",
    highlight && "border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_20px_rgba(79,70,229,0.1)]"
  )}>
    <div className="flex items-center gap-1 mb-1 opacity-50">
      {icon}
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <span className={cn("text-lg font-black font-mono italic leading-none", highlight ? "text-indigo-400" : color)}>
      {value}
    </span>
  </div>
);

const Shield = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);
