import React from "react";
import { Match, Team, Tournament, UserProfile } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, BarChart3, Calendar, ListFilter, Users as UsersIcon, Shield, Star, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TeamPerformanceProps {
  team: Team;
  matches: Match[];
  tournaments: Tournament[];
  allPlayers?: UserProfile[];
}

export const TeamPerformance: React.FC<TeamPerformanceProps> = ({ team, matches, tournaments, allPlayers = [] }) => {
  // Filter matches involving this team
  const teamMatches = matches.filter(m => m.team1Id === team.id || m.team2Id === team.id)
    .sort((a, b) => (matchStatusOrder(a.status) - matchStatusOrder(b.status)));

  function matchStatusOrder(status: string) {
    if (status === "live") return 0;
    if (status === "upcoming") return 1;
    return 2;
  }

  const teamSquad = allPlayers.filter(p => team.playerIds?.includes(p.uid));

  const totalMatchesCount = teamMatches.filter(m => m.status === "completed").length;
  const wins = teamMatches.filter(m => m.status === "completed" && m.winnerId === team.id).length;
  const losses = teamMatches.filter(m => m.status === "completed" && m.winnerId !== team.id && m.winnerId !== "tie").length;
  const winRate = totalMatchesCount > 0 ? ((wins / totalMatchesCount) * 100).toFixed(0) : "0";

  return (
    <div className="space-y-8">
      {/* Team Profile Card - Premium Aesthetic */}
      <Card className="bg-slate-950 border-white/10 overflow-hidden rounded-[2.5rem] relative shadow-2xl">
        {/* Dynamic Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-900/40 via-slate-950 to-black" />
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-600/20 rounded-full blur-[90px]" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-purple-600/10 rounded-full blur-[90px]" />
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:20px_20px]" />
        </div>

        <CardContent className="p-8 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/40 border-4 border-white/10 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                  <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-slate-900 rounded-full border-2 border-indigo-500 flex items-center justify-center shadow-xl">
                  <Star className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] drop-shadow-sm">Team Franchise</span>
                  <div className="h-px bg-indigo-500/20 w-12" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter leading-none">{team.name}</h2>
                <div className="flex items-center gap-3">
                  <Badge className="bg-indigo-600/90 hover:bg-indigo-600 text-[9px] font-black italic uppercase px-3 py-1 tracking-wider shadow-lg">Manager Overview</Badge>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter px-2 border-l border-white/10">ID: {team.teamId || team.id}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:flex gap-3 sm:gap-4">
              <StatsBox label="Played" value={totalMatchesCount} />
              <StatsBox label="Win %" value={`${winRate}%`} highlight="text-emerald-400" />
              <StatsBox label="Squad" value={team.playerIds?.length || 0} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-slate-900/30 p-2 rounded-[2rem] border border-white/5">
          <TabsList className="bg-transparent p-1 gap-2">
            <TabsTrigger value="all" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400 rounded-2xl px-6 py-2.5 font-black italic uppercase text-[10px] transition-all">
              <ListFilter className="w-3.5 h-3.5 mr-2" /> Matches
            </TabsTrigger>
            <TabsTrigger value="tournaments" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400 rounded-2xl px-6 py-2.5 font-black italic uppercase text-[10px] transition-all">
              <Calendar className="w-3.5 h-3.5 mr-2" /> Series
            </TabsTrigger>
            <TabsTrigger value="squad" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400 rounded-2xl px-6 py-2.5 font-black italic uppercase text-[10px] transition-all">
              <UsersIcon className="w-3.5 h-3.5 mr-2" /> Squad
            </TabsTrigger>
          </TabsList>

          <div className="px-6 flex gap-6">
             <TrendStat label="Won" value={wins} color="text-emerald-400" />
             <TrendStat label="Lost" value={losses} color="text-red-400" />
          </div>
        </div>

        <TabsContent value="all" className="mt-0 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teamMatches.length > 0 ? (
              teamMatches.map((match) => (
                <MatchCard key={match.id} match={match} teamId={team.id} />
              ))
            ) : (
              <EmptyState message="No global match record found." />
            )}
          </div>
        </TabsContent>

        <TabsContent value="tournaments" className="mt-0 space-y-12 outline-none">
          {(() => {
            const participatingTournaments = tournaments.filter(t => teamMatches.some(m => m.tournamentId === t.id));
            
            if (participatingTournaments.length === 0) {
              return <EmptyState message="No series participation recorded." />;
            }

            return participatingTournaments.map(tournament => {
              const tournamentMatches = teamMatches.filter(m => m.tournamentId === tournament.id);
              return (
                <div key={tournament.id} className="space-y-6">
                  <div className="flex items-center gap-4 px-4 bg-white/5 py-3 rounded-2xl border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/10">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-black text-white uppercase italic tracking-wider">{tournament.name}</h4>
                      <p className="text-[10px] font-black text-indigo-400/70 uppercase tracking-widest">Active Tournament Series</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {tournamentMatches.map((match) => (
                      <MatchCard key={match.id} match={match} teamId={team.id} />
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </TabsContent>

        <TabsContent value="squad" className="mt-0 outline-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamSquad.length > 0 ? (
              teamSquad.map((player) => (
                <PlayerMiniCard key={player.uid} player={player} />
              ))
            ) : (
              <EmptyState message="No players found in this squad." />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StatsBox = ({ label, value, highlight = "text-white" }: { label: string, value: string | number, highlight?: string }) => (
  <div className="bg-white/[0.03] backdrop-blur-md px-6 py-4 rounded-[1.8rem] border border-white/10 flex flex-col items-center justify-center min-w-[100px] shadow-xl group hover:border-indigo-500/50 transition-all duration-300">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 group-hover:text-indigo-400 transition-colors">{label}</span>
    <span className={`text-2xl font-black italic font-mono tracking-tighter ${highlight}`}>{value}</span>
  </div>
);

const TrendStat = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="flex items-center gap-2">
    <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text', 'bg')}`} />
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}:</span>
    <span className={`text-xs font-black italic font-mono ${color}`}>{value}</span>
  </div>
);

const MatchCard: React.FC<{ match: Match; teamId: string }> = ({ match, teamId }) => {
  const isWinner = match.winnerId === teamId;
  const isLive = match.status === "live";
  const isFinished = match.status === "completed";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`bg-slate-900/50 backdrop-blur-sm border-white/5 overflow-hidden group hover:border-indigo-500/40 transition-all rounded-[2rem] shadow-xl hover:shadow-indigo-500/5 ${isLive ? 'border-red-500/30' : ''}`}>
        <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex justify-between items-center relative overflow-hidden">
          {isLive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 animate-pulse" />}
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-0.5">Match Report</span>
            <span className="text-xs font-black text-white italic uppercase tracking-tighter max-w-[180px] truncate">{match.name}</span>
          </div>
          {isLive ? (
            <Badge className="bg-red-600 animate-pulse text-[9px] font-black italic tracking-widest px-3 py-1">LIVE ACTION</Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] font-black text-indigo-400 uppercase italic border-indigo-500/20">{match.status}</Badge>
          )}
        </div>
        <CardContent className="p-7 space-y-6">
          <div className="grid grid-cols-5 items-center">
             <div className="col-span-2 text-center space-y-2">
                <div className="text-[10px] font-black text-indigo-400 uppercase italic tracking-widest">Our Side</div>
                <div className="text-2xl font-black text-white font-mono italic tracking-tighter">
                  {(() => {
                    const ourInnings = match.innings[1].battingTeamId === teamId ? match.innings[1] : (match.innings[2].battingTeamId === teamId ? match.innings[2] : null);
                    return ourInnings ? `${ourInnings.runs}/${ourInnings.wickets}` : "--/--";
                  })()}
                </div>
                <div className="text-[9px] font-bold text-slate-500 font-mono tracking-widest">
                   {(() => {
                    const ourInnings = match.innings[1].battingTeamId === teamId ? match.innings[1] : (match.innings[2].battingTeamId === teamId ? match.innings[2] : null);
                    return ourInnings ? `(${(ourInnings.balls / 6).toFixed(1)} Ov)` : "";
                  })()}
                </div>
             </div>
             
             <div className="col-span-1 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center text-slate-700 font-black italic text-[11px] border border-white/5">VS</div>
             </div>

             <div className="col-span-2 text-center space-y-2">
                <div className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest">Opponent</div>
                <div className="text-2xl font-black text-white/50 font-mono italic tracking-tighter">
                  {(() => {
                    const oppInnings = match.innings[1].battingTeamId !== teamId ? match.innings[1] : (match.innings[2].battingTeamId !== teamId ? match.innings[2] : null);
                    return oppInnings ? `${oppInnings.runs}/${oppInnings.wickets}` : "--/--";
                  })()}
                </div>
                 <div className="text-[9px] font-bold text-slate-500/50 font-mono tracking-widest">
                   {(() => {
                    const oppInnings = match.innings[1].battingTeamId !== teamId ? match.innings[1] : (match.innings[2].battingTeamId !== teamId ? match.innings[2] : null);
                    return oppInnings ? `(${(oppInnings.balls / 6).toFixed(1)} Ov)` : "";
                  })()}
                </div>
             </div>
          </div>

          {isFinished && (
            <div className={`mt-2 py-3 px-4 rounded-2xl text-center text-[10px] font-black uppercase italic tracking-widest shadow-inner ${isWinner ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : match.winnerId === 'tie' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
              {isWinner ? "Match Victorious" : match.winnerId === "tie" ? "Match Tied" : "Defeat In Counter"}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const PlayerMiniCard: React.FC<{ player: UserProfile }> = ({ player }) => (
  <Card className="bg-slate-900 border-white/5 p-4 rounded-3xl flex items-center gap-4 hover:border-indigo-500/30 transition-all">
    <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 p-0.5 bg-slate-800">
      {player.photoURL ? (
        <img src={player.photoURL} alt={player.displayName} className="w-full h-full object-cover rounded-full" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs font-black text-white/20">{player.displayName[0]}</div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <h5 className="text-xs font-black text-white uppercase italic truncate tracking-tight">{player.displayName}</h5>
      <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest leading-none mt-0.5">{player.specialization || "All Rounder"}</p>
    </div>
    <div className="text-right">
       <div className="text-[10px] font-black text-white italic">{player.stats?.runs || 0}</div>
       <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Runs</div>
    </div>
  </Card>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="col-span-full py-16 flex flex-col items-center justify-center bg-slate-950 border-2 border-dashed border-white/5 rounded-[3rem]">
    <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-6">
       <Zap className="w-8 h-8 text-slate-800" />
    </div>
    <p className="text-slate-500 font-black italic uppercase text-xs tracking-[0.2em]">{message}</p>
  </div>
);
