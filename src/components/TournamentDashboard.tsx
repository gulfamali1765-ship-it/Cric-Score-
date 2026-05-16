import React, { useState, useEffect } from "react";
import { Tournament, Match, PointTable as PointTableType, TournamentStage, Team } from "../types";
import { db, auth } from "../firebase";
import { collection, query, where, onSnapshot, doc, getDocs, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { finalizeMatchStats } from "../services/matchService";
import { Calendar, Play, Lock, ChevronRight, Trophy, BarChart2, Layers, X, CheckCircle2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PointTable } from "./PointTable";
import { MatchScorer } from "./MatchScorer";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

export const TournamentDashboard: React.FC<{ tournamentId: string }> = ({ tournamentId }) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [pointTable, setPointTable] = useState<PointTableType | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const hasStarted = matches.some(m => m.status === "live" || m.status === "completed");

  useEffect(() => {
    const unsubT = onSnapshot(doc(db, "tournaments", tournamentId), (snap) => {
      if (snap.exists()) setTournament({ ...snap.data(), id: snap.id } as Tournament);
    });

    const matchesQuery = query(collection(db, "tournaments", tournamentId, "matches"));
    const unsubM = onSnapshot(matchesQuery, (snap) => {
      setMatches(snap.docs.map(d => ({ ...d.data(), id: d.id } as Match)));
    });

    // Fetch all teams once
    getDocs(collection(db, "teams")).then(snap => {
      setAllTeams(snap.docs.map(d => ({ ...d.data(), id: d.id } as Team)));
    });

    const sessionUid = sessionStorage.getItem("cric_active_uid");
    const activeUid = auth.currentUser?.uid || sessionUid;

    if (activeUid) {
      onSnapshot(doc(db, "users", activeUid), (snap) => {
        if (snap.exists()) setUserRole(snap.data().role);
      });
    }

    return () => { unsubT(); unsubM(); };
  }, [tournamentId]);

  useEffect(() => {
    if (tournament?.currentStageId) {
      const unsubP = onSnapshot(doc(db, "tournaments", tournamentId, "pointTables", tournament.currentStageId), (snap) => {
        if (snap.exists()) setPointTable(snap.data() as PointTableType);
        else setPointTable(null);
      });
      return () => unsubP();
    }
  }, [tournament?.currentStageId, tournamentId]);

  const getTeamName = (id: string) => allTeams.find(t => t.id === id)?.name || id;

  const generateSchedule = async (targetStageId: string, teamListRaw: string[]) => {
    // Ensure uniqueness
    const teamList = Array.from(new Set(teamListRaw || []));
    
    if (!tournament || teamList.length < 2) return toast.error("Not enough teams");
    
    const matches: Partial<Match>[] = [];
    const stage = tournament.stages.find(s => s.id === targetStageId);
    if (!stage) return;

    if (stage.type === "round-robin") {
      for (let i = 0; i < teamList.length; i++) {
        for (let j = i + 1; j < teamList.length; j++) {
          const matchId = uuidv4();
          matches.push({
            id: matchId,
            tournamentId,
            stageId: targetStageId,
            name: `${stage.name} - Match ${matches.length + 1}`,
            team1Id: teamList[i],
            team2Id: teamList[j],
            status: "scheduled",
            overs: tournament.overs,
            playersPerTeam: tournament.playersPerTeam,
            currentInnings: 1,
            innings: {
              1: { battingTeamId: teamList[i], bowlingTeamId: teamList[j], runs: 0, wickets: 0, balls: 0, history: [], playerStats: {} },
              2: { battingTeamId: teamList[j], bowlingTeamId: teamList[i], runs: 0, wickets: 0, balls: 0, history: [], playerStats: {} }
            }
          });
        }
      }
    } else if (stage.type === "knockout" || stage.type === "group-knockout" || stage.type === "playoff" || stage.type === "double-elimination") {
      // Basic implementation for high-level prototypes: pair teams sequentially
      // For a production app, we would implement specific bracket logic here
      for (let i = 0; i < teamList.length; i += 2) {
        if (i + 1 < teamList.length) {
          const matchId = uuidv4();
          matches.push({
            id: matchId,
            tournamentId,
            stageId: targetStageId,
            name: `${stage.name} - ${stage.type === 'knockout' ? 'Round' : 'Match'} ${matches.length + 1}`,
            team1Id: teamList[i],
            team2Id: teamList[i+1],
            status: "scheduled",
            overs: tournament.overs,
            playersPerTeam: tournament.playersPerTeam,
            currentInnings: 1,
            innings: {
              1: { battingTeamId: teamList[i], bowlingTeamId: teamList[i+1], runs: 0, wickets: 0, balls: 0, history: [], playerStats: {} },
              2: { battingTeamId: teamList[i+1], bowlingTeamId: teamList[i], runs: 0, wickets: 0, balls: 0, history: [], playerStats: {} }
            }
          });
        }
      }
    }

    for (const match of matches) {
      await setDoc(doc(db, "tournaments", tournamentId, "matches", match.id!), match);
    }
    
    // Create initial Point Table
    const table: PointTableType = {
      tournamentId,
      stageId: targetStageId,
      entries: teamList.map(tid => ({
        teamId: tid,
        teamName: getTeamName(tid),
        played: 0, won: 0, lost: 0, tied: 0, points: 0, nrr: 0
      }))
    };
    await setDoc(doc(db, "tournaments", tournamentId, "pointTables", targetStageId), table);

    await updateDoc(doc(db, "tournaments", tournamentId), { 
      status: "ongoing",
      currentStageId: targetStageId
    });
    toast.success(`${stage.name} Schedule generated!`);
  };

  const moveToNextStage = async () => {
    if (!tournament || !pointTable) return;
    
    const currentIndex = tournament.stages.findIndex(s => s.id === tournament.currentStageId);
    if (currentIndex === -1 || currentIndex === tournament.stages.length - 1) {
      await updateDoc(doc(db, "tournaments", tournamentId), { status: "completed" });
      return toast.success("Tournament Completed!");
    }

    const nextStage = tournament.stages[currentIndex + 1];
    const currentStage = tournament.stages[currentIndex];
    
    // Determine Qualifiers
    const qualifiersCount = currentStage.config.qualifiersCount || 2;
    const qualifiers = pointTable.entries
      .sort((a, b) => b.points - a.points || b.nrr - a.nrr)
      .slice(0, qualifiersCount)
      .map(e => e.teamId);

    if (qualifiers.length < 2) return toast.error("Not enough qualifiers for next stage");

    await generateSchedule(nextStage.id, qualifiers);
  };

  const startMatch = async (matchId: string) => {
    await updateDoc(doc(db, "tournaments", tournamentId), { status: "ongoing" });
    await updateDoc(doc(db, "tournaments", tournamentId, "matches", matchId), { status: "live" });
    setActiveMatchId(matchId);
  };

  const updateTournamentDetails = async () => {
    try {
      await updateDoc(doc(db, "tournaments", tournamentId), {
        name: editName,
        description: editDesc
      });
      setIsEditing(false);
      toast.success("Tournament details updated!");
    } catch (e) {
      toast.error("Failed to update details");
    }
  };

  const isStageComplete = matches.length > 0 && matches.every(m => m.status === "completed");

  if (!tournament) return <div className="p-8 text-center text-white font-black italic">Tournament Not Found</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-8">
      {activeMatchId ? (
        <div>
          <Button variant="ghost" onClick={() => setActiveMatchId(null)} className="text-white mb-4">← Back to Dashboard</Button>
          <MatchScorer matchId={activeMatchId} tournamentId={tournamentId} />
        </div>
      ) : (
        <>
          {/* Tournament Overview Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-slate-900/40 p-8 rounded-[2rem] border border-white/5 backdrop-blur-xl">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-600 text-white italic px-3">{tournament.status.toUpperCase()}</Badge>
                  <span className="text-slate-500 text-[10px] uppercase font-black tracking-widest italic">{tournament.overs} Overs Match</span>
                </div>
                <h1 className="text-5xl font-black text-white italic tracking-tighter leading-none">{tournament.name}</h1>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                    <Layers className="w-3 h-3 text-indigo-500" />
                    Current Stage: <span className="text-white">{tournament.stages.find(s => s.id === tournament.currentStageId)?.name || 'Setup'}</span>
                  </div>
                  {userRole === "arranger" && (
                    <Button 
                      disabled={hasStarted}
                      onClick={() => {
                        setEditName(tournament.name);
                        setEditDesc(tournament.description || "");
                        setIsEditing(true);
                      }}
                      variant="ghost" 
                      className="h-8 px-3 text-[10px] font-black italic bg-white/5 text-indigo-400 border border-white/5 hover:bg-white/10 gap-2"
                    >
                      <Edit3 className="w-3 h-3" /> {hasStarted ? "EDIT LOCKED" : "EDIT DETAILS"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                {userRole === "arranger" && tournament.status === "setup" && (
                  <Button onClick={() => generateSchedule(tournament.stages[0].id, tournament.teamIds)} className="bg-white text-black hover:bg-slate-200 font-black italic px-8 h-14 rounded-2xl shadow-2xl shadow-indigo-500/20">
                    Generate Schedule
                  </Button>
                )}
                {userRole === "arranger" && tournament.status === "ongoing" && (
                  <Button 
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm("Force end this tournament? Status will be set to completed. This will hide ongoing match options.")) {
                        const toastId = toast.loading("Ending tournament...");
                        try {
                          await updateDoc(doc(db, "tournaments", tournamentId), { status: "completed" });
                          toast.success("Tournament forced to completion");
                        } catch (err) {
                          toast.error("Operation failed");
                        } finally {
                          toast.dismiss(toastId);
                        }
                      }
                    }}
                    variant="outline"
                    className="border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white font-black italic px-4 h-14 rounded-2xl transition-all shadow-xl shadow-red-500/10"
                  >
                    Force End
                  </Button>
                )}
                {userRole === "arranger" && isStageComplete && (
                  <Button onClick={moveToNextStage} className="bg-emerald-600 text-white hover:bg-emerald-700 font-black italic px-8 h-14 rounded-2xl shadow-2xl shadow-emerald-500/20 gap-2">
                    <Trophy className="w-5 h-5" /> Progress to Next Stage
                  </Button>
                )}
              </div>
          </div>

          <Tabs defaultValue="timetable" className="w-full">
          <TabsList className="bg-slate-900/50 p-1 rounded-2xl border border-white/10 mb-6">
            <TabsTrigger value="timetable" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-200 rounded-xl px-8 font-black italic uppercase text-xs transition-all">
              <Calendar className="w-4 h-4 mr-2" /> Timetable
            </TabsTrigger>
            <TabsTrigger value="standings" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-200 rounded-xl px-8 font-black italic uppercase text-xs transition-all">
              <BarChart2 className="w-4 h-4 mr-2" /> Standings
            </TabsTrigger>
          </TabsList>

            <TabsContent value="timetable" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {matches.filter(m => m.status !== "deleted").map(match => (
                  <Card key={match.id} className="bg-slate-900 border-white/5 overflow-hidden group hover:border-indigo-500/50 transition-all">
                    <div className="p-4 bg-white/5 flex justify-between items-center border-b border-white/5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{match.status}</span>
                      {match.status === "live" && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                    </div>
                    <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="text-center flex-1">
                          <div className="w-12 h-12 bg-white/5 rounded-2xl mx-auto mb-2 flex items-center justify-center font-black text-indigo-400 italic">
                            {getTeamName(match.team1Id)[0]}
                          </div>
                          <span className="text-xs font-black text-white uppercase italic">{getTeamName(match.team1Id)}</span>
                        </div>
                        <div className="px-4 text-white/20 font-black italic">VS</div>
                        <div className="text-center flex-1">
                          <div className="w-12 h-12 bg-white/5 rounded-2xl mx-auto mb-2 flex items-center justify-center font-black text-indigo-400 italic">
                            {getTeamName(match.team2Id)[0]}
                          </div>
                          <span className="text-xs font-black text-white uppercase italic">{getTeamName(match.team2Id)}</span>
                        </div>
                      </div>
                      
                      {userRole === "arranger" && match.status !== "completed" && match.status !== "deleted" && (
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => match.status === "scheduled" ? startMatch(match.id) : setActiveMatchId(match.id)}
                            className="flex-1 bg-white text-black font-black uppercase italic rounded-xl h-10 hover:bg-indigo-400 transition-all text-xs"
                          >
                            {match.status === "scheduled" ? "Start Match" : "Resume Scoring"}
                          </Button>
                          
                          {match.status === "live" && (
                            <Button 
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm("Mark this match as Completed (Draw)? stats will be added to the players and teams")) {
                                  const toastId = toast.loading("Updating match...");
                                  try {
                                    await updateDoc(doc(db, "tournaments", tournamentId, "matches", match.id), { status: "completed", winnerId: "tie" });
                                    await finalizeMatchStats(match, tournamentId, "tie");
                                    toast.success("Match marked as completed");
                                  } catch (err) {
                                    toast.error("Update failed");
                                  } finally {
                                    toast.dismiss(toastId);
                                  }
                                }
                              }}
                              variant="ghost"
                              size="icon"
                              className="w-10 h-10 rounded-xl bg-amber-600/10 hover:bg-amber-600 text-amber-500 hover:text-white transition-all shadow-lg"
                              title="Force Complete (Draw)"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </Button>
                          )}

                          {match.status === "scheduled" && (
                            <Button 
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm("Delete this scheduled match?")) {
                                  const toastId = toast.loading("Deleting match...");
                                  try {
                                    await updateDoc(doc(db, "tournaments", tournamentId, "matches", match.id), { status: "deleted" });
                                    toast.success("Match deleted");
                                  } catch (err) {
                                    toast.error("Delete failed");
                                  } finally {
                                    toast.dismiss(toastId);
                                  }
                                }
                              }}
                              variant="ghost"
                              size="icon"
                              className="w-10 h-10 rounded-xl bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white transition-all shadow-lg"
                              title="Delete Match"
                            >
                              <X className="w-5 h-5" />
                            </Button>
                          )}
                        </div>
                      )}
                      
                      {match.status === "completed" && (
                        <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Winner</span>
                          <span className="text-emerald-400 font-black italic">{getTeamName(match.winnerId || "")}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="standings">
              {pointTable ? (
                <PointTable table={pointTable} />
              ) : (
                <div className="text-center py-20 text-slate-600 font-black italic uppercase tracking-[0.3em]">No standings available yet</div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-slate-900 border-white/10">
            <CardHeader>
              <CardTitle className="text-white font-black italic uppercase">Edit Tournament</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Tournament Name</label>
                <input 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl h-12 px-4 text-white font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Description</label>
                <textarea 
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-medium h-32 resize-none"
                />
              </div>
            </CardContent>
            <div className="p-6 pt-0 flex gap-2">
               <Button onClick={() => setIsEditing(false)} variant="ghost" className="flex-1 text-slate-400">Cancel</Button>
               <Button onClick={updateTournamentDetails} className="flex-1 bg-indigo-600 text-white font-black italic">Save Changes</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
