import React, { useState } from "react";
import { Tournament, TournamentStage } from "../types";
import { Trophy, Plus, Trash2, Save, Layers, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { v4 as uuidv4 } from 'uuid';
import { db, auth } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { toast } from "sonner";

export const TournamentCreator: React.FC = () => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxTeams, setMaxTeams] = useState(4);
  const [overs, setOvers] = useState(3);
  const [playersPerTeam, setPlayersPerTeam] = useState(11);
  const [stages, setStages] = useState<TournamentStage[]>([
    {
      id: uuidv4(),
      name: "Group Stage",
      type: "round-robin",
      order: 1,
      config: { matchesPerTeam: 1, qualifiersCount: 4 },
      status: "pending"
    }
  ]);

  const [isFormatSelectorOpen, setIsFormatSelectorOpen] = useState<{ isOpen: boolean; stageId: string | null }>({ isOpen: false, stageId: null });
  const [viewingDetails, setViewingDetails] = useState<string | null>(null);

  const FORMAT_DETAILS: Record<string, { title: string; icon: string; description: string; mechanics: string; timetable: string }> = {
    "round-robin": {
      title: "Round Robin",
      icon: "📊",
      description: "Every team plays against every other team in the group. Points are awarded for wins and ties.",
      mechanics: "A points table tracks performance. The top N teams advance to the next stage based on points and Net Run Rate (NRR).",
      timetable: "Automatically generated so each team meets the other exactly N times."
    },
    "knockout": {
      title: "Knockout",
      icon: "⚔️",
      description: "A 'do or die' format where losing a single match results in immediate elimination.",
      mechanics: "Teams are paired. Winners move to the next round; losers are out. Brackets can be seed-based.",
      timetable: "Direct bracket system (Round of 16 -> Quarters -> Semis -> Final)."
    },
    "playoff": {
      title: "IPL Playoffs",
      icon: "🏆",
      description: "Provides a double chance to the top two teams in the points table.",
      mechanics: "Qualifier 1, Eliminator, Qualifier 2, and Final. Rewards consistency in group stages.",
      timetable: "Four high-stakes matches concluding the tournament."
    },
    "double-elimination": {
      title: "Double Elimination",
      icon: "🔄",
      description: "Teams must lose two matches before being fully eliminated.",
      mechanics: "Losers drop to a 'Losers Bracket' where they can still fight their way back to the final.",
      timetable: "Maintains two brackets. More matches and more opportunities for recovery."
    },
    "group-knockout": {
      title: "Group + Knockout",
      icon: "📂",
      description: "Hybrid format starting with groups followed by a knockout stage.",
      mechanics: "Teams split into groups. Top performers from each group enter Quarter-Finals or Semi-Finals.",
      timetable: "Initial group matches followed by a standard knockout bracket."
    }
  };

  const addStage = () => {
    const newStage: TournamentStage = {
      id: uuidv4(),
      name: `Stage ${stages.length + 1}`,
      type: "round-robin",
      order: stages.length + 1,
      config: { matchesPerTeam: 1, qualifiersCount: 2 },
      status: "pending"
    };
    setStages([...stages, newStage]);
  };

  const removeStage = (id: string) => {
    if (stages.length === 1) return;
    setStages(stages.filter(s => s.id !== id).map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  const updateStage = (id: string, updates: Partial<TournamentStage>) => {
    setStages(stages.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const createTournament = async () => {
    if (!name.trim()) return toast.error("Tournament name is required");
    const sessionUid = sessionStorage.getItem("cric_active_uid");
    const activeUid = auth.currentUser?.uid || sessionUid;
    if (!activeUid) return toast.error("You must be logged in");

    const tournamentId = uuidv4();
    const tournament: Tournament = {
      id: tournamentId,
      name,
      description,
      arrangerUid: activeUid,
      status: "setup",
      maxTeams,
      overs,
      playersPerTeam,
      stages,
      currentStageId: stages[0].id,
      teamIds: []
    };

    try {
      await setDoc(doc(db, "tournaments", tournamentId), tournament);
      toast.success("Tournament created successfully!");
      // Reset form or redirect
    } catch (error) {
      console.error(error);
      toast.error("Failed to create tournament");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      <Card className="border-2 border-indigo-500/20 shadow-xl bg-slate-900/50 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-black text-white italic">Create Tournament</CardTitle>
            <p className="text-slate-400 text-sm">Define your tournament structure & stages</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white font-bold">Tournament Name</Label>
              <Input 
                id="name" 
                placeholder="e.g. Champions Trophy 2024" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-slate-800 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white font-bold">Category Limits</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-black">Overs</span>
                  <Input type="number" min={1} value={overs} onChange={e => setOvers(parseInt(e.target.value) || 0)} className="bg-slate-800 border-white/10 text-white h-9" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-black">Limit</span>
                  <Input type="number" min={2} value={maxTeams} onChange={e => setMaxTeams(parseInt(e.target.value) || 0)} className="bg-slate-800 border-white/10 text-white h-9" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-black">Players</span>
                  <Input type="number" min={1} value={playersPerTeam} onChange={e => setPlayersPerTeam(parseInt(e.target.value) || 0)} className="bg-slate-800 border-white/10 text-white h-9" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="text-lg font-black text-white italic flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                Tournament Stages
              </h4>
              <Button onClick={addStage} variant="outline" size="sm" className="bg-white/5 border-white/10 text-white gap-2">
                <Plus className="w-4 h-4" /> Add Stage
              </Button>
            </div>

            <div className="space-y-4">
              {stages.map((stage, index) => (
                <Card key={stage.id} className="bg-white/5 border-white/10 overflow-hidden">
                  <div className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 font-black">STAGE NAME</Label>
                        <Input 
                          value={stage.name} 
                          onChange={e => updateStage(stage.id, { name: e.target.value })}
                          className="bg-slate-800 border-white/10 text-white text-xs h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 font-black">TYPE</Label>
                        <Button 
                          onClick={() => setIsFormatSelectorOpen({ isOpen: true, stageId: stage.id })}
                          variant="outline" 
                          className="w-full bg-slate-800 border-white/10 text-white text-xs h-8 justify-between px-3"
                        >
                          <span className="truncate">{FORMAT_DETAILS[stage.type]?.title || "Select Format"}</span>
                          <Layers className="w-3 h-3 opacity-50" />
                        </Button>
                      </div>
                      {stage.type === "round-robin" && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-slate-500 font-black">MATCHES/TEAM</Label>
                            <Input 
                              type="number"
                              value={stage.config.matchesPerTeam} 
                              onChange={e => updateStage(stage.id, { config: { ...stage.config, matchesPerTeam: parseInt(e.target.value) || 0 } })}
                              className="bg-slate-800 border-white/10 text-white text-xs h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-slate-500 font-black">QUALIFIERS</Label>
                            <Input 
                              type="number"
                              value={stage.config.qualifiersCount} 
                              onChange={e => updateStage(stage.id, { config: { ...stage.config, qualifiersCount: parseInt(e.target.value) || 0 } })}
                              className="bg-slate-800 border-white/10 text-white text-xs h-8"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeStage(stage.id)}
                      className="text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={createTournament} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black gap-2 h-12 rounded-xl text-lg">
            <Save className="w-5 h-5" /> Create Tournament
          </Button>
        </CardFooter>
      </Card>
      {/* Full Screen Format Selector */}
      {isFormatSelectorOpen.isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col p-6 overflow-y-auto animate-in fade-in duration-300">
          <div className="max-w-5xl mx-auto w-full space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Select Tournament Format</h2>
                <p className="text-slate-400 font-bold">Choose how this stage will be contested</p>
              </div>
              <Button 
                variant="ghost" 
                onClick={() => setIsFormatSelectorOpen({ isOpen: false, stageId: null })}
                className="text-white bg-white/5 rounded-full w-12 h-12 p-0 hover:bg-white/10"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(FORMAT_DETAILS).map(([key, detail]) => (
                <Card key={key} className="bg-slate-900 border-white/10 border-2 hover:border-indigo-500 transition-all group overflow-hidden flex flex-col">
                  <div className="p-8 flex-1 space-y-4">
                    <div className="text-4xl">{detail.icon}</div>
                    <div>
                      <h3 className="text-2xl font-black text-white italic uppercase">{detail.title}</h3>
                      <p className="text-slate-400 text-sm italic">{detail.description}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 flex gap-2">
                    <Button 
                      onClick={() => setViewingDetails(key)}
                      variant="ghost" 
                      className="flex-1 text-slate-400 hover:text-white hover:bg-white/5 font-black italic text-xs gap-2"
                    >
                      <Info className="w-4 h-4" /> DETAILS
                    </Button>
                    <Button 
                      onClick={() => {
                        if (isFormatSelectorOpen.stageId) {
                          updateStage(isFormatSelectorOpen.stageId, { type: key as any });
                          setIsFormatSelectorOpen({ isOpen: false, stageId: null });
                        }
                      }}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black italic text-xs"
                    >
                      SELECT FORMAT
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Format Detail Modal */}
      {viewingDetails && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <Card className="max-w-lg w-full bg-slate-900 border-indigo-500/30 border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                 <span className="text-4xl">{FORMAT_DETAILS[viewingDetails].icon}</span>
                 <CardTitle className="text-2xl font-black italic text-white uppercase">{FORMAT_DETAILS[viewingDetails].title}</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setViewingDetails(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="space-y-2">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">How it works</span>
                <p className="text-slate-300 text-sm leading-relaxed">{FORMAT_DETAILS[viewingDetails].mechanics}</p>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Timetable Generation</span>
                <p className="text-slate-300 text-sm leading-relaxed">{FORMAT_DETAILS[viewingDetails].timetable}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={() => setViewingDetails(null)} className="w-full bg-white/10 hover:bg-white/20 text-white font-black italic">CLOSE DETAILS</Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
