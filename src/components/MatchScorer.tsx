import React, { useState, useEffect, useCallback } from "react";
import { Match, BallEvent, UserProfile, UserProfile as Player } from "../types";
import { Circle, User, Star, ChevronLeft, Gavel, History, CheckCircle2, Users, Home, RotateCcw, AlertCircle, Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Team } from "../types";
import { doc, updateDoc, onSnapshot, increment, getDoc, handleFirestoreError, OperationType } from "../firebase";
import { db } from "../firebase";
import { finalizeMatchStats } from "../services/matchService";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

interface MatchScorerProps {
  matchId: string;
  tournamentId: string;
}

const createEmptyStats = (uid: string, name: string) => ({
  uid,
  name,
  runs: 0,
  balls: 0,
  fours: 0,
  sixes: 0,
  wickets: 0,
  bowlingRuns: 0,
  bowlingBalls: 0,
  overs: 0,
  isOut: false
});

export const MatchScorer: React.FC<MatchScorerProps> = ({ matchId, tournamentId }) => {
  const [match, setMatch] = useState<Match | null>(null);
  const [strikerUid, setStrikerUid] = useState("");
  const [nonStrikerUid, setNonStrikerUid] = useState("");
  const [bowlerUid, setBowlerUid] = useState("");
  const [team1Players, setTeam1Players] = useState<UserProfile[]>([]);
  const [team2Players, setTeam2Players] = useState<UserProfile[]>([]);
  const [teamNames, setTeamNames] = useState({ 1: "", 2: "" });
  
  const [tossStep, setTossStep] = useState<1 | 2>(1);
  const [localTossWinner, setLocalTossWinner] = useState<string | null>(null);

  // Scoring modifiers - removed redundant toggles
  const [isWide, setIsWide] = useState(false);
  const [isNoBall, setIsNoBall] = useState(false);
  const [isWicket, setIsWicket] = useState(false);

  const getPlayerName = useCallback((uid: string) => {
    if (!uid) return "";
    const p = [...team1Players, ...team2Players].find(player => player.uid === uid);
    return p?.displayName || "";
  }, [team1Players, team2Players]);

  // Wicket logic state
  const [wicketModalOpen, setWicketModalOpen] = useState(false);
  const [wicketStep, setWicketStep] = useState<"type" | "fielder" | "batsman">("type");
  const [pendingBallValue, setPendingBallValue] = useState<number>(0);
  const [tempWicketDetails, setTempWicketDetails] = useState<{
      type: "bowled" | "caught" | "lbw" | "run-out" | "stumped" | "others";
      fielderUid?: string;
      outBatsmanUid?: string;
  }>({ type: "bowled" });

  const getMatchRef = useCallback(() => {
    return (tournamentId && tournamentId !== "standalone")
      ? doc(db, "tournaments", tournamentId, "matches", matchId)
      : doc(db, "matches", matchId);
  }, [tournamentId, matchId]);

  useEffect(() => {
    if (!matchId) return;
    const matchRef = getMatchRef();

    const unsub = onSnapshot(matchRef, async (snap) => {
      if (snap.exists()) {
        const matchData = { id: snap.id, ...snap.data() } as Match;
        setMatch(matchData);
        
        // Sync lineup state from Firestore
        if (matchData.strikerUid) setStrikerUid(matchData.strikerUid);
        if (matchData.nonStrikerUid) setNonStrikerUid(matchData.nonStrikerUid);
        if (matchData.bowlerUid) setBowlerUid(matchData.bowlerUid);

        // Fetch players for both teams
        const fetchTeamData = async (teamId: string) => {
          if (!teamId) return { name: "Unknown", players: [] };
          try {
            const teamSnap = await getDoc(doc(db, "teams", teamId));
            if (teamSnap.exists()) {
              const teamData = { id: teamSnap.id, ...teamSnap.data() } as Team;
              // Deduplicate player IDs before fetching
              const uniquePlayerIds = Array.from(new Set(teamData.playerIds || []));
              const playerDocs = await Promise.all(
                uniquePlayerIds.map(pid => getDoc(doc(db, "users", pid)))
              );
              return {
                name: teamData.name,
                players: playerDocs
                  .filter(d => d.exists())
                  .map(d => ({ ...d.data(), uid: d.id } as UserProfile))
              };
            }
          } catch (e) {
            handleFirestoreError(e, OperationType.GET, `teams/${teamId}`);
          }
          return { name: "Unknown", players: [] };
        };

        const t1 = await fetchTeamData(matchData.team1Id);
        const t2 = await fetchTeamData(matchData.team2Id);
        
        setTeam1Players(t1.players);
        setTeam2Players(t2.players);
        setTeamNames({ 1: t1.name, 2: t2.name });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `matches/${matchId}`));
    return () => unsub();
  }, [matchId, tournamentId]);

  const saveLineup = async () => {
    if (!match) return;
    const matchRef = getMatchRef();

    const battingTeamPlayers = match.innings[match.currentInnings].battingTeamId === match.team1Id ? team1Players : team2Players;
    
    if (battingTeamPlayers.length === 0) return toast.error("Batting team has no players!");
    if (!strikerUid || !bowlerUid) return toast.error("Select striker and bowler");
    
    if (match.playersPerTeam > 1 && strikerUid === nonStrikerUid) return toast.error("Striker and Non-Striker must be different players");
    
    if (match.playersPerTeam > 1 && BattingPlayers(match, team1Players, team2Players).length > 1 && !nonStrikerUid) {
      return toast.error("Select non-striker");
    }

    try {
      await updateDoc(matchRef, {
        strikerUid,
        nonStrikerUid: match.playersPerTeam > 1 ? nonStrikerUid : "",
        bowlerUid
      });
      toast.success("Lineup saved! Ready to score.");
    } catch (e) {
      toast.error("Failed to save lineup");
    }
  };

  const handleTossDecision = async (decision: "bat" | "bowl") => {
    if (!match || !localTossWinner) return;
    
    const team1Id = match.team1Id;
    const team2Id = match.team2Id;
    
    let inn1Bat, inn1Bowl, inn2Bat, inn2Bowl;

    if (localTossWinner === team1Id) {
      if (decision === "bat") {
        inn1Bat = team1Id; inn1Bowl = team2Id;
        inn2Bat = team2Id; inn2Bowl = team1Id;
      } else {
        inn1Bat = team2Id; inn1Bowl = team1Id;
        inn2Bat = team1Id; inn2Bowl = team2Id;
      }
    } else {
      if (decision === "bat") {
        inn1Bat = team2Id; inn1Bowl = team1Id;
        inn2Bat = team1Id; inn2Bowl = team2Id;
      } else {
        inn1Bat = team1Id; inn1Bowl = team2Id;
        inn2Bat = team2Id; inn2Bowl = team1Id;
      }
    }

    try {
      const matchRef = getMatchRef();
      await updateDoc(matchRef, {
        tossWinnerId: localTossWinner,
        tossDecision: decision,
        "innings.1.battingTeamId": inn1Bat,
        "innings.1.bowlingTeamId": inn1Bowl,
        "innings.2.battingTeamId": inn2Bat,
        "innings.2.bowlingTeamId": inn2Bowl,
      });
      toast.success("Toss completed! Start Match.");
    } catch (e) {
      toast.error("Failed to update toss");
    }
  };

  const handleBall = async (value: number, wicketDetailsOverride?: any, extraType?: 'wide' | 'no-ball', forceWicket?: boolean) => {
    if (!match || !strikerUid || !bowlerUid) return toast.error("Select batsman and bowler first");
    
    const currentIsWide = !!(extraType === 'wide' || isWide);
    const currentIsNoBall = !!(extraType === 'no-ball' || isNoBall);
    const currentIsWicket = !!(isWicket || forceWicket || (wicketDetailsOverride !== undefined && wicketDetailsOverride !== null));

    // If it is a wicket and we don't have details yet, show modal
    if (currentIsWicket && !wicketDetailsOverride) {
      setPendingBallValue(value);
      setTempWicketDetails({ 
        type: "bowled", 
        outBatsmanUid: strikerUid 
      });
      setWicketStep("type");
      setWicketModalOpen(true);
      return;
    }

    let type: BallEvent["type"] = "run";
    if (currentIsWicket) type = "wicket";
    else if (currentIsWide) type = "wide";
    else if (currentIsNoBall) type = "no-ball";

    const matchRef = getMatchRef();
    
    const isLegal = !currentIsWide && !currentIsNoBall;
    const ballEvent: any = {
      type,
      value,
      batsmanUid: strikerUid,
      bowlerUid,
      isLegal,
      timestamp: Date.now(),
      isWide: currentIsWide,
      isNoBall: currentIsNoBall
    };

    if (wicketDetailsOverride) {
      const cleanWicket = { ...wicketDetailsOverride };
      Object.keys(cleanWicket).forEach(k => (cleanWicket[k] === undefined || cleanWicket[k] === null) && delete cleanWicket[k]);
      ballEvent.wicketDetails = cleanWicket;
    }

    const currentInningsNum = match.currentInnings;
    const currentInnings = match.innings[currentInningsNum];
    
    const newInnings = JSON.parse(JSON.stringify(currentInnings));
    newInnings.history = [...(newInnings.history || []), ballEvent];
    
    const extraRun = (currentIsWide || currentIsNoBall) ? 1 : 0;
    newInnings.runs = (newInnings.runs || 0) + value + extraRun;
    if (isLegal) newInnings.balls = (newInnings.balls || 0) + 1;

    const lastBowlerId = bowlerUid;
    const batsmanUidOut = (wicketDetailsOverride && wicketDetailsOverride.outBatsmanUid) || strikerUid;
    const battingTeamPlayers = match.innings[match.currentInnings].battingTeamId === match.team1Id ? team1Players : team2Players;
    const bowlingTeamPlayers = match.innings[match.currentInnings].bowlingTeamId === match.team1Id ? team1Players : team2Players;
    const allKnownPlayers = [...team1Players, ...team2Players];

    const targetPlayerName = (uid: string, fallback: string) => {
      const p = allKnownPlayers.find(p => p.uid === uid);
      return p?.displayName || fallback;
    };

    const batsmanStats = newInnings.playerStats[strikerUid] || createEmptyStats(strikerUid, targetPlayerName(strikerUid, "Batsman"));
    // Ensure name is refreshed if it was generic
    if (batsmanStats.name === "Batsman") {
      batsmanStats.name = targetPlayerName(strikerUid, "Batsman");
    }
    
    const runsForBatsman = !currentIsWide ? value : 0;
    batsmanStats.runs = (batsmanStats.runs || 0) + runsForBatsman;
    if (isLegal) batsmanStats.balls = (batsmanStats.balls || 0) + 1;
    if (runsForBatsman === 4) batsmanStats.fours = (batsmanStats.fours || 0) + 1;
    if (runsForBatsman === 6) batsmanStats.sixes = (batsmanStats.sixes || 0) + 1;
    
    if (currentIsWicket) {
      newInnings.wickets = (newInnings.wickets || 0) + 1;
      const outStats = newInnings.playerStats[batsmanUidOut] || createEmptyStats(batsmanUidOut, targetPlayerName(batsmanUidOut, "Batsman"));
      if (outStats.name === "Batsman") {
        outStats.name = targetPlayerName(batsmanUidOut, "Batsman");
      }
      outStats.isOut = true;
      newInnings.playerStats[batsmanUidOut] = outStats;
    }
    newInnings.playerStats[strikerUid] = batsmanStats;

    const bowlerStats = newInnings.playerStats[bowlerUid] || createEmptyStats(bowlerUid, targetPlayerName(bowlerUid, "Bowler"));
    if (bowlerStats.name === "Bowler") {
      bowlerStats.name = targetPlayerName(bowlerUid, "Bowler");
    }
    if (isLegal) {
      bowlerStats.bowlingBalls = (bowlerStats.bowlingBalls || 0) + 1;
      bowlerStats.overs = Math.floor(bowlerStats.bowlingBalls / 6) + (bowlerStats.bowlingBalls % 6) / 10;
    }
    bowlerStats.bowlingRuns = (bowlerStats.bowlingRuns || 0) + value + extraRun;
    
    if (currentIsWicket && wicketDetailsOverride?.type !== "run-out") {
      bowlerStats.wickets = (bowlerStats.wickets || 0) + 1;
    }
    newInnings.playerStats[bowlerUid] = bowlerStats;

    const maxBalls = (match.overs || 1) * 6;
    const isAllOut = match.playersPerTeam > 1 
      ? newInnings.wickets >= match.playersPerTeam - 1 
      : newInnings.wickets >= 1;
    const isInningsOver = newInnings.balls >= maxBalls || isAllOut;

    let matchWinnerId: string | null = null;
    let matchStatus = match.status;

    if (currentInningsNum === 2) {
      const target = (match.innings[1]?.runs || 0) + 1;
      if (newInnings.runs >= target) {
        matchWinnerId = newInnings.battingTeamId;
        matchStatus = "completed";
      } else if (isInningsOver) {
        if (newInnings.runs === match.innings[1].runs) {
          matchWinnerId = "tie";
        } else {
          matchWinnerId = match.innings[1].battingTeamId;
        }
        matchStatus = "completed";
      }
    }

    try {
      const updateData: any = {
        [`innings.${currentInningsNum}`]: newInnings
      };

      if (isInningsOver && currentInningsNum === 1) {
        updateData.currentInnings = 2;
        updateData.strikerUid = "";
        updateData.nonStrikerUid = "";
        updateData.bowlerUid = "";
        setStrikerUid("");
        setNonStrikerUid("");
        setBowlerUid("");
      } else if (currentIsWicket && !isInningsOver) {
        if (batsmanUidOut === strikerUid) {
          updateData.strikerUid = "";
          setStrikerUid("");
        } else {
          updateData.nonStrikerUid = "";
          setNonStrikerUid("");
        }
      }
      
      if (matchStatus === "completed") {
        updateData.status = "completed";
        updateData.winnerId = matchWinnerId;
      }

      // Strike rotation logic
      let shouldRotate = false;
      let nsUid = nonStrikerUid; // Use current state for non-striker
      
      if (value % 2 !== 0 && type === "run") {
        shouldRotate = true;
      }
      
      if (isLegal && newInnings.balls % 6 === 0 && !isInningsOver) {
        shouldRotate = !shouldRotate;
        updateData.lastBowlerUid = lastBowlerId; 

        // Only clear bowler if it's not a single-player match
        if (match.playersPerTeam > 1) {
          updateData.bowlerUid = ""; 
          setBowlerUid(""); 
          toast.info("Over completed! Select new bowler.");
        } else {
          toast.success("Over completed! Continue bowling.");
        }
      }

      if (shouldRotate && nsUid) {
        // Only rotate if not out
        const finalStriker = updateData.strikerUid === "" ? "" : strikerUid;
        const finalNonStriker = updateData.nonStrikerUid === "" ? "" : nsUid;
        
        if (finalStriker && finalNonStriker) {
            const nextStriker = finalNonStriker;
            const nextNonStriker = finalStriker;
            setStrikerUid(nextStriker);
            setNonStrikerUid(nextNonStriker);
            updateData.strikerUid = nextStriker;
            updateData.nonStrikerUid = nextNonStriker;
        }
      }
      
      // Deep clean function
      const deepClean = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(deepClean).filter(v => v !== undefined);
        const newObj: any = {};
        for (const key in obj) {
          const val = obj[key];
          if (val !== undefined && val !== null && !Number.isNaN(val)) {
            newObj[key] = deepClean(val);
          }
        }
        return newObj;
      };

      const finalUpdate = deepClean(updateData);
      await updateDoc(matchRef, finalUpdate);
      
      setIsWide(false);
      setIsNoBall(false);
      setIsWicket(false);

      if (matchStatus === "completed") {
        await finalizeMatchStats(match, tournamentId, matchWinnerId!);
      }
      
      setWicketModalOpen(false);
      setIsWicket(false);
    } catch (err) {
      console.error("Firestore Update Error:", err);
      toast.error("Failed to update score. Check internet connection.");
    }
  };


  const getBatsmanLiveStats = (uid: string) => {
    if (!match || !uid) return { runs: 0, balls: 0, fours: 0, sixes: 0, sr: "0.0", name: "" };
    const currentInnings = match.innings[match.currentInnings];
    const name = getPlayerName(uid) || currentInnings.playerStats[uid]?.name || "Batsman";
    if (!currentInnings.playerStats[uid]) return { runs: 0, balls: 0, fours: 0, sixes: 0, sr: "0.0", name };
    const s = currentInnings.playerStats[uid];
    const sr = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(0) : "0";
    return { ...s, sr, name };
  };

  const getBowlerLiveStats = (uid: string) => {
    if (!match || !uid) return { overs: "0.0", wickets: 0, bowlingRuns: 0, name: "" };
    const currentInnings = match.innings[match.currentInnings];
    const name = getPlayerName(uid) || currentInnings.playerStats[uid]?.name || "Bowler";
    if (!currentInnings.playerStats[uid]) return { overs: "0.0", wickets: 0, bowlingRuns: 0, name };
    return { ...currentInnings.playerStats[uid], name };
  };

  const handleBallSwap = async () => {
    if (!match) return;
    const temp = strikerUid;
    setStrikerUid(nonStrikerUid);
    setNonStrikerUid(temp);
    const matchRef = getMatchRef();
    await updateDoc(matchRef, { strikerUid: nonStrikerUid, nonStrikerUid: strikerUid });
  };

  const handleUndo = async () => {
    if (!match) return;
    const currentInningsNum = match.currentInnings;
    const currentInnings = match.innings[currentInningsNum];
    
    if (!currentInnings.history || currentInnings.history.length === 0) return toast.info("Nothing to undo");

    const newHistory = [...currentInnings.history];
    const lastEvent = newHistory.pop()!;
    
    const newInnings = { ...currentInnings };
    newInnings.history = newHistory;
    
    // Reverse logic
    const { type, value, batsmanUid, bowlerUid, isLegal } = lastEvent;
    newInnings.runs -= (value + (type === "wide" || type === "no-ball" ? 1 : 0));
    if (isLegal) newInnings.balls -= 1;
    if (type === "wicket") newInnings.wickets -= 1;

    // Player stats reversal
    const bStats = newInnings.playerStats[batsmanUid];
    if (bStats) {
      bStats.runs -= value;
      if (isLegal) bStats.balls -= 1;
      if (value === 4) bStats.fours -= 1;
      if (value === 6) bStats.sixes -= 1;
      if (type === "wicket") bStats.isOut = false;
    }

    const blStats = newInnings.playerStats[bowlerUid];
    if (blStats) {
      if (isLegal) {
        blStats.bowlingBalls -= 1;
        blStats.overs = Math.floor(blStats.bowlingBalls / 6) + (blStats.bowlingBalls % 6) / 10;
      }
      blStats.bowlingRuns -= (value + (type === "wide" || type === "no-ball" ? 1 : 0));
      if (type === "wicket") blStats.wickets -= 1;
    }

    const matchRef = getMatchRef();
    try {
      await updateDoc(matchRef, {
        [`innings.${currentInningsNum}`]: newInnings,
        strikerUid: batsmanUid // For safety, reset striker to the one who played the ball
      });
      setStrikerUid(batsmanUid);
      toast.success("Last action undone");
    } catch (e) {
      toast.error("Undo failed");
    }
  };

  if (!match) return <div className="p-8 text-center text-white px-8 py-12 flex flex-col items-center justify-center gap-4">
    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    <span className="font-black italic uppercase tracking-widest animate-pulse">Loading Match Stream...</span>
  </div>;

  const team1Empty = team1Players.length === 0;
  const team2Empty = team2Players.length === 0;
  
  if (team1Empty || team2Empty) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-slate-50 font-sans">
        <Card className="max-w-md w-full border-0 shadow-2xl rounded-3xl overflow-hidden bg-white">
          <div className="bg-red-500 h-2 w-full" />
          <CardContent className="p-10 text-center space-y-6">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-indigo-950 uppercase italic tracking-tighter">Incomplete Rosters</h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                Roster verification failed. Both teams must have registered players.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
               <div className="text-center overflow-hidden">
                 <p className="text-[9px] font-black text-slate-400 uppercase mb-1 truncate">{teamNames[1]}</p>
                 <p className={`text-sm font-black italic ${team1Empty ? 'text-red-500' : 'text-emerald-600'}`}>{team1Players.length} Members</p>
               </div>
               <div className="text-center border-l border-slate-200 overflow-hidden">
                 <p className="text-[9px] font-black text-slate-400 uppercase mb-1 truncate">{teamNames[2]}</p>
                 <p className={`text-sm font-black italic ${team2Empty ? 'text-red-500' : 'text-emerald-600'}`}>{team2Players.length} Members</p>
               </div>
            </div>
            <p className="text-[10px] text-slate-400 font-medium italic">Please update team squads in the manager before proceeding.</p>
            <Button variant="outline" className="w-full h-12 rounded-xl border-slate-200 text-slate-400 font-black uppercase tracking-widest hover:text-indigo-900" onClick={() => window.history.back()}>
              ← Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentInningsNum = match.currentInnings;
  const currentInnings = match.innings[currentInningsNum];
  const target = currentInningsNum === 2 ? (match.innings[1]?.runs || 0) + 1 : null;
  const totalBalls = (match.overs || 1) * 6;
  const ballsRemaining = Math.max(0, totalBalls - currentInnings.balls);
  const crr = currentInnings.balls > 0 ? (currentInnings.runs * 6 / currentInnings.balls).toFixed(2) : "0.00";
  const rrr = (target && ballsRemaining > 0) ? (Math.max(0, target - currentInnings.runs) * 6 / ballsRemaining).toFixed(2) : null;
  const battingTeamName = currentInnings.battingTeamId === match.team1Id ? teamNames[1] : teamNames[2];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pb-24 font-sans selection:bg-indigo-100">
      {/* Wicket Dialog */}
      <Dialog open={wicketModalOpen} onOpenChange={(open) => {
        if (!open) {
          setWicketModalOpen(false);
          setIsWicket(false); // Reset toggle if canceled
        }
      }}>
        <DialogContent className="bg-white border-0 rounded-[2.5rem] max-w-sm w-[95%] p-0 overflow-hidden shadow-2xl z-[200]">
          <div className="bg-red-600 h-2 w-full" />
          <div className="p-8 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-indigo-950 uppercase italic tracking-tighter text-center">
                {wicketStep === "type" ? "Type of Wicket" : 
                 wicketStep === "fielder" ? "Select Fielder" : "Who is Out?"}
              </DialogTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] text-center">
                {wicketStep === "type" ? "How did the wicket fall?" : 
                 wicketStep === "fielder" ? "Credit for the dismissal" : "Select the dismissed batsman"}
              </p>
            </DialogHeader>

            {wicketStep === "type" && (
              <div className="grid grid-cols-2 gap-3">
                {["bowled", "caught", "lbw", "run-out", "stumped", "others"].map((type) => (
                  <Button 
                    key={type}
                    variant="outline"
                    className="h-16 rounded-2xl border-slate-100 hover:border-red-500 hover:bg-red-50 text-indigo-950 font-black uppercase italic text-xs transition-all shadow-sm"
                    onClick={() => {
                      const nextDetails = { ...tempWicketDetails, type: type as any };
                      setTempWicketDetails(nextDetails);
                      if (type === "caught" || type === "stumped") {
                        setWicketStep("fielder");
                      } else if (type === "run-out") {
                        setWicketStep("fielder"); // First fielder, then batsman
                      } else {
                        handleBall(pendingBallValue, nextDetails);
                      }
                    }}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            )}

            {wicketStep === "fielder" && (
              <div className="space-y-4">
                 <div className="bg-slate-50 p-2 rounded-2xl max-h-[300px] overflow-y-auto space-y-2">
                    {(match.innings[match.currentInnings].bowlingTeamId === match.team1Id ? team1Players : team2Players).map(player => (
                      <button
                        key={player.uid}
                        className="w-full p-3 text-left rounded-xl hover:bg-indigo-50 flex items-center justify-between group"
                        onClick={() => {
                          const nextDetails = { ...tempWicketDetails, fielderUid: player.uid };
                          setTempWicketDetails(nextDetails);
                          if (tempWicketDetails.type === "run-out") {
                            setWicketStep("batsman");
                          } else {
                            handleBall(pendingBallValue, nextDetails);
                          }
                        }}
                      >
                        <span className="text-xs font-bold text-indigo-950 uppercase italic">{player.displayName}</span>
                        <Plus className="w-3 h-3 text-slate-300 group-hover:text-indigo-600" />
                      </button>
                    ))}
                 </div>
                 {tempWicketDetails.type !== "run-out" && (
                   <Button 
                     variant="ghost" 
                     className="w-full text-[10px] font-black uppercase text-slate-400"
                     onClick={() => handleBall(pendingBallValue, tempWicketDetails)}
                   >
                     Skip Fielder
                   </Button>
                 )}
              </div>
            )}

            {wicketStep === "batsman" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {[strikerUid, nonStrikerUid].filter(Boolean).map(uid => {
                    const stats = getBatsmanLiveStats(uid);
                    return (
                      <Button
                        key={uid}
                        variant="outline"
                        className="h-16 rounded-2xl border-slate-100 hover:border-red-500 hover:bg-red-50 text-indigo-950 font-black uppercase italic text-sm transition-all shadow-sm"
                        onClick={() => {
                          const nextDetails = { ...tempWicketDetails, outBatsmanUid: uid };
                          setTempWicketDetails(nextDetails);
                          handleBall(pendingBallValue, nextDetails);
                        }}
                      >
                        {stats.name} {uid === strikerUid ? "(Striker)" : "(Non-Striker)"}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Sticky Header */}
      <div className="w-full max-w-xl bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => window.history.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-indigo-900" />
          </button>
          <div className="text-center">
            <h1 className="text-md font-black text-indigo-900 uppercase tracking-tight">Total Overs : {match.overs}</h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{match.status} match</p>
          </div>
          <button onClick={() => window.location.reload()} className="p-2 bg-indigo-900 rounded-xl shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95 transition-transform">
            <Home className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <div className="w-full max-w-xl p-4 space-y-4">
        {/* Score Header Card */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <Card className="border-0 shadow-2xl shadow-indigo-200/40 overflow-hidden bg-white rounded-[2.5rem]">
            <CardContent className="p-8 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] -z-10 opacity-50" />
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-indigo-950/40 text-[10px] font-black uppercase tracking-[0.3em] font-mono">{battingTeamName}</p>
                  <h2 className="text-6xl font-black text-indigo-950 lining-nums tracking-tighter font-mono">
                    {currentInnings.runs}<span className="text-3xl text-indigo-200 mx-1">/</span>{currentInnings.wickets}
                  </h2>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-indigo-950/40 text-[10px] font-black uppercase tracking-[0.3em] font-mono text-right">Over</p>
                  <h2 className="text-4xl font-black text-indigo-950 lining-nums tracking-tighter font-mono">
                    {Math.floor(currentInnings.balls / 6)}<span className="text-xl text-indigo-200">.{currentInnings.balls % 6}</span>
                  </h2>
                </div>
              </div>
              
              <div className="mt-8 flex justify-between items-center bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                  <span className="text-[10px] font-black text-indigo-900 uppercase italic">Live Stream</span>
                </div>
                <div className="flex gap-4">
                   <div className="text-center">
                     <p className="text-[8px] font-bold text-slate-400 uppercase">CRR</p>
                     <p className="text-xs font-black text-indigo-900 font-mono">{crr}</p>
                   </div>
                   {rrr && (
                     <div className="text-center">
                       <p className="text-[8px] font-bold text-slate-400 uppercase">RRR</p>
                       <p className="text-xs font-black text-emerald-600 font-mono">{rrr}</p>
                     </div>
                   )}
                </div>
              </div>
  
              {target && (
                <div className="mt-4 p-4 bg-indigo-900 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-900/20">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <p className="text-[10px] font-black text-white uppercase italic tracking-tight">
                    Target: {target} <span className="opacity-30 mx-2">|</span> Need {target - currentInnings.runs} from {ballsRemaining} balls
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Dynamic Section: Toss -> Lineup -> Controls */}
        {!match.tossWinnerId ? (
          <TossCard match={match} teamNames={teamNames} tossStep={tossStep} setTossStep={setTossStep} localTossWinner={localTossWinner} setLocalTossWinner={setLocalTossWinner} handleTossDecision={handleTossDecision} />
        ) : (!match.strikerUid || (match.playersPerTeam > 1 && !match.nonStrikerUid && BattingPlayers(match, team1Players, team2Players).length > 0)) ? (
          <div className="space-y-4">
             {match.currentInnings === 2 && (
               <InningsSummaryCard 
                 innings={match.innings[1]} 
                 teamName={match.innings[1].battingTeamId === match.team1Id ? teamNames[1] : teamNames[2]} 
                 title="First Inning" 
                 allPlayers={[...team1Players, ...team2Players]}
               />
             )}
             <div className="p-8 bg-white rounded-[2rem] shadow-xl border border-slate-100 space-y-8 animate-in slide-in-from-bottom duration-500">
                <div className="text-center space-y-1">
                  <h3 className="text-2xl font-black text-indigo-950 uppercase italic tracking-tighter">{match.currentInnings === 2 ? "Second Inning Setup" : "Inning Lineup"}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em]">Assign Active Players</p>
                </div>
                <div className="space-y-6">
                   <div className="space-y-5 bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                     <PlayerSelector 
                       label="Striker" 
                       selectedUid={strikerUid} 
                       onSelect={setStrikerUid} 
                       players={BattingPlayers(match, team1Players, team2Players).filter(p => p.uid !== nonStrikerUid)} 
                     />
                     {(match.playersPerTeam > 1 && BattingPlayers(match, team1Players, team2Players).length > 1) && (
                       <PlayerSelector 
                         label="Non-Striker" 
                         selectedUid={nonStrikerUid} 
                         onSelect={setNonStrikerUid} 
                         players={BattingPlayers(match, team1Players, team2Players).filter(p => p.uid !== strikerUid)} 
                       />
                     )}
                   </div>
                   <div className="bg-indigo-50 p-6 rounded-[1.5rem] border border-indigo-100">
                     <PlayerSelector label="Current Bowler" selectedUid={bowlerUid} onSelect={setBowlerUid} players={BowlingPlayers(match, team1Players, team2Players)} />
                   </div>
                </div>
                <Button onClick={saveLineup} className="w-full h-16 rounded-2xl font-black uppercase italic bg-indigo-900 hover:bg-indigo-950 shadow-2xl shadow-indigo-900/40 text-lg transition-all active:scale-95">Lock & Start Playing</Button>
             </div>
          </div>
        ) : (
          /* Live Scoring Section */
          <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
            {/* Players Tables */}
            <Card className="border-0 shadow-lg shadow-slate-200/50 bg-white rounded-[2rem] overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-4 text-[10px] font-black text-indigo-900/60 uppercase tracking-widest">Batsman</th>
                        <th className="px-3 py-4 text-[10px] font-black text-indigo-900/60 uppercase tracking-widest text-center">R</th>
                        <th className="px-3 py-4 text-[10px] font-black text-indigo-900/60 uppercase tracking-widest text-center">B</th>
                        <th className="px-3 py-4 text-[10px] font-black text-indigo-900/60 uppercase tracking-widest text-center">4s</th>
                        <th className="px-3 py-4 text-[10px] font-black text-indigo-900/60 uppercase tracking-widest text-center">6s</th>
                        <th className="px-3 py-4 text-[10px] font-black text-indigo-900/60 uppercase tracking-widest text-center">SR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {[strikerUid, nonStrikerUid].map((uid) => {
                        if (!uid) return null;
                        const stats = getBatsmanLiveStats(uid);
                        const isStriker = uid === strikerUid;
                        return (
                          <tr key={uid} className={isStriker ? "bg-indigo-50/50" : ""}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`text-[13px] font-black uppercase italic ${isStriker ? 'text-indigo-900' : 'text-slate-400'}`}>
                                  {stats.name || "Player"}
                                </span>
                                {isStriker && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />}
                              </div>
                            </td>
                            <td className="px-3 py-4 text-center text-sm font-black text-indigo-950">{stats.runs}</td>
                            <td className="px-3 py-4 text-center text-xs text-slate-400 font-bold">{stats.balls}</td>
                            <td className="px-3 py-4 text-center text-xs text-slate-400 font-bold">{stats.fours}</td>
                            <td className="px-3 py-4 text-center text-xs text-slate-400 font-bold">{stats.sixes}</td>
                            <td className="px-3 py-4 text-center text-[10px] font-black text-indigo-900/40 italic">{stats.sr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 border-y border-slate-100 flex items-center px-5 py-4">
                  <div className="flex-1 text-[10px] font-black text-indigo-900/70 uppercase tracking-widest">Bowler</div>
                  <div className="w-16 text-[10px] font-black text-indigo-900/70 uppercase tracking-widest text-center">O</div>
                  <div className="w-16 text-[10px] font-black text-indigo-900/70 uppercase tracking-widest text-center">W</div>
                  <div className="w-16 text-[10px] font-black text-indigo-900/70 uppercase tracking-widest text-center">R</div>
                </div>

                <div className="flex items-center px-5 py-5 gap-4 bg-indigo-50/30">
                  <div className="flex-1">
                    {!bowlerUid ? (
                      <div className="w-full space-y-2">
                        <p className="text-[10px] font-black text-indigo-600 uppercase italic animate-pulse">Waiting for Next Bowler...</p>
                        <Select 
                          value={""} 
                          onValueChange={async (v) => {
                            const matchRef = getMatchRef();
                            await updateDoc(matchRef, { bowlerUid: v });
                            setBowlerUid(v);
                          }}
                        >
                          <SelectTrigger className="bg-indigo-600 border-indigo-700 text-white h-12 rounded-xl w-full shadow-lg shadow-indigo-200">
                            <span className="text-[12px] font-black uppercase italic">Pick Next Bowler</span>
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-100 text-indigo-950 z-[100] rounded-2xl shadow-2xl">
                             {BowlingPlayers(match, team1Players, team2Players).map(p => (
                               <SelectItem key={p.uid} value={p.uid} className="text-[10px] font-black uppercase italic py-3">
                                 {p.displayName}
                               </SelectItem>
                             ))}
                             {/* Allow same bowler if team has only 1 player */}
                             {(BowlingPlayers(match, team1Players, team2Players).length === 0 && team2Players.length === 1) && (
                               BowlingPlayers({...match, lastBowlerUid: undefined} as any, team1Players, team2Players).map(p => (
                                 <SelectItem key={p.uid} value={p.uid} className="text-[10px] font-black uppercase italic py-3">
                                   {p.displayName} (Solo)
                                 </SelectItem>
                               ))
                             )}
                             {BowlingPlayers(match, team1Players, team2Players).length === 0 && team2Players.length > 1 && (
                               <div className="p-4 text-[10px] font-bold text-slate-400 uppercase text-center">No available bowlers (Max overs reached?)</div>
                             )}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">{getBowlerLiveStats(bowlerUid).name}</span>
                        <div className="text-[13px] font-black uppercase italic text-indigo-900 border-l-2 border-indigo-600 pl-2">
                          BOWLING NOW
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="w-16 text-center text-sm font-black text-slate-600">{getBowlerLiveStats(bowlerUid).overs}</div>
                  <div className="w-16 text-center text-sm font-black text-slate-600">{getBowlerLiveStats(bowlerUid).wickets}</div>
                  <div className="w-16 text-center text-sm font-black text-slate-600">{getBowlerLiveStats(bowlerUid).bowlingRuns}</div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {/* Current Matchup Bar */}
              <div className="bg-indigo-50/50 p-4 rounded-[1.5rem] border border-indigo-100 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{getBatsmanLiveStats(strikerUid).name || "Batsman"}</span>
                  <span className="text-sm font-black text-indigo-900 uppercase italic">On Strike</span>
                </div>
                <div className="text-indigo-200">
                  <Minus className="w-6 h-6 rotate-90" />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{getBowlerLiveStats(bowlerUid).name || "Bowler"}</span>
                  <span className="text-sm font-black text-indigo-900 uppercase italic">Bowling</span>
                </div>
              </div>

              {/* Main Control Keypad */}
              <Card className="border-0 shadow-xl shadow-slate-200/50 bg-white rounded-[2.5rem] p-6">
                <div className="flex justify-between items-center mb-6">
                  <p className="text-[10px] font-black text-indigo-900/30 uppercase tracking-widest italic">Ball Actions</p>
                  <div className="flex gap-1">
                    {currentInnings.history?.slice(-5).map((ball, i) => (
                      <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                        ball.type === 'wicket' ? 'bg-red-500 text-white border-red-500' : 
                        ball.type === 'wide' || ball.type === 'no-ball' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {ball.type === 'wicket' ? 'W' : ball.value}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {/* Runs */}
                  {[0, 1, 2, 3, 4, 6, 5].map((num) => (
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      key={num} 
                      onClick={() => handleBall(num)}
                      className={`aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center shadow-sm active:shadow-inner ${
                        num === 4 ? 'bg-emerald-50 border-emerald-500 text-emerald-600' :
                        num === 6 ? 'bg-indigo-50 border-indigo-600 text-indigo-700' :
                        'border-slate-100 bg-white text-indigo-900'
                      }`}
                    >
                      <span className="text-2xl font-black font-mono tracking-tighter">{num}</span>
                      <span className="text-[7px] font-black uppercase opacity-40 leading-none mt-0.5">
                        {num === 4 ? 'Four' : num === 6 ? 'Six' : num === 0 ? 'Dot' : 'Runs'}
                      </span>
                    </motion.button>
                  ))}

                  {/* Wicket */}
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleBall(0, undefined, undefined, true)}
                    className="aspect-square rounded-2xl border-2 border-red-100 bg-red-50 text-red-600 transition-all flex flex-col items-center justify-center shadow-sm active:shadow-inner"
                  >
                    <span className="text-2xl font-black font-mono tracking-tighter">W</span>
                    <span className="text-[7px] font-black uppercase opacity-60 leading-none mt-0.5">Out</span>
                  </motion.button>

                  {/* Extras */}
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleBall(0, undefined, 'wide')}
                    className="aspect-square rounded-2xl border-2 border-amber-100 bg-amber-50 text-amber-600 transition-all flex flex-col items-center justify-center shadow-sm active:shadow-inner"
                  >
                    <span className="text-xl font-black font-mono tracking-tighter">WD</span>
                    <span className="text-[7px] font-black uppercase opacity-60 leading-none mt-0.5">Wide</span>
                  </motion.button>

                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleBall(0, undefined, 'no-ball')}
                    className="aspect-square rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-600 transition-all flex flex-col items-center justify-center shadow-sm active:shadow-inner"
                  >
                    <span className="text-xl font-black font-mono tracking-tighter">NB</span>
                    <span className="text-[7px] font-black uppercase opacity-60 leading-none mt-0.5">No ball</span>
                  </motion.button>

                  {/* Tactical Actions */}
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={handleBallSwap}
                    className="aspect-square rounded-2xl border-2 border-indigo-100 bg-indigo-50 text-indigo-700 transition-all flex flex-col items-center justify-center shadow-sm active:shadow-inner"
                  >
                    <RotateCcw className="w-5 h-5 mb-0.5" />
                    <span className="text-[7px] font-black uppercase opacity-60 leading-none">Swap</span>
                  </motion.button>

                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={handleUndo}
                    className="aspect-square rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-400 transition-all flex flex-col items-center justify-center shadow-sm active:shadow-inner"
                  >
                    <History className="w-5 h-5 mb-0.5" />
                    <span className="text-[7px] font-black uppercase opacity-60 leading-none">Undo</span>
                  </motion.button>

                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={async () => {
                      const matchRef = getMatchRef();
                      if (match.playersPerTeam > 1) {
                        await updateDoc(matchRef, { bowlerUid: "" });
                        setBowlerUid("");
                        toast.info("Over completed! Select new bowler.");
                      } else {
                        toast.info("Over transition noted.");
                      }
                    }}
                    className="col-span-4 h-14 mt-2 rounded-[1.25rem] bg-indigo-900 text-white font-black uppercase italic tracking-widest text-xs flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
                  >
                    Next Over Processed
                  </motion.button>
                </div>
              </Card>
            </div>

            <div className="bg-indigo-950 p-6 rounded-[1.5rem] shadow-2xl shadow-indigo-900/30 flex justify-between items-center px-10">
              <div className="space-y-0.5">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">CRR</p>
                <p className="text-xl font-black text-white italic">{crr}</p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Extras</p>
                <p className="text-xl font-black text-indigo-400 italic">
                  {Number(currentInnings.runs) - Number(Object.values(currentInnings.playerStats || {}).reduce((acc: number, p: any) => acc + (p.runs || 0), 0))}
                </p>
              </div>
            </div>
          </div>
        )
      }

      
      {/* Completion View */}
      {match.status === "completed" && (
        <div className="w-full space-y-6 animate-in fade-in zoom-in duration-1000">
          <Card className="bg-indigo-900 border-0 overflow-hidden shadow-2xl rounded-[2.5rem] text-center p-12 space-y-4">
            <div className="bg-white/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
              <Star className="w-10 h-10 text-white fill-white" />
            </div>
            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Match Finished</h2>
            <div className="inline-block py-3 px-10 bg-white rounded-2xl shadow-xl">
               <p className="text-indigo-900 font-extrabold text-lg uppercase tracking-tight">
                 Winner: {match.winnerId === "tie" ? "MATCH TIED" : (match.winnerId === match.team1Id ? teamNames[1] : teamNames[2])}
               </p>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <InningsSummaryCard innings={match.innings[1]} teamName={match.innings[1].battingTeamId === match.team1Id ? teamNames[1] : teamNames[2]} title="First Inning" allPlayers={[...team1Players, ...team2Players]} />
             <InningsSummaryCard innings={match.innings[2]} teamName={match.innings[2].battingTeamId === match.team1Id ? teamNames[1] : teamNames[2]} title="Second Inning" allPlayers={[...team1Players, ...team2Players]} />
          </div>

          <Button 
            onClick={() => window.location.reload()} 
            className="w-full h-16 rounded-[1.5rem] font-black uppercase italic tracking-widest text-white bg-indigo-900 hover:bg-slate-900 shadow-2xl shadow-indigo-900/20"
          >
            Finished Playing
          </Button>
        </div>
      )}
      </div>
    </div>
  );
};

const InningsDisplay = ({ label, runs, wickets, balls, active }: any) => (
  <div className={`flex flex-col items-center p-3 rounded-2xl ${active ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
    <span className="text-[9px] font-black tracking-[0.2em] mb-1 uppercase">{label}</span>
    <span className="text-xl font-black lining-nums">{runs}/{wickets}</span>
    <span className="text-[9px] font-bold opacity-60">({Math.floor(balls / 6)}.{balls % 6})</span>
  </div>
);

const InningsSummaryCard = ({ innings, teamName, title = "Summary", allPlayers = [] }: any) => {
  const getPName = (uid: string, fallback: string) => {
    if (fallback !== "Batsman" && fallback !== "Bowler" && fallback !== "" && fallback) return fallback;
    const p = allPlayers.find((player: any) => player.uid === uid);
    return p?.displayName || fallback;
  };

  const players = Object.values(innings.playerStats || {}) as any[];
  const batsmen = players.filter(p => p.balls > 0).sort((a, b) => b.runs - a.runs);
  const bowlers = players.filter(p => p.bowlingBalls > 0).sort((a, b) => b.wickets - a.wickets);

  return (
    <Card className="border-0 shadow-xl shadow-slate-200/50 bg-white rounded-3xl overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-6">
        <CardTitle className="text-xs font-black text-indigo-900 uppercase tracking-widest italic flex justify-between items-center">
          <span>{title}: {teamName}</span>
          <span className="text-indigo-600 lining-nums">{innings.runs}/{innings.wickets} <span className="text-[10px] text-slate-400 font-bold">({Math.floor(innings.balls / 6)}.{innings.balls % 6})</span></span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Top Batsmen</p>
            {batsmen.slice(0, 3).map((p, i) => (
              <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                <span className="text-[10px] font-bold text-indigo-950 uppercase truncate max-w-[80px]">{getPName(p.uid, p.name)}</span>
                <span className="text-[10px] font-black text-indigo-600">{p.runs}<span className="text-[8px] text-slate-400 ml-1">({p.balls})</span></span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Top Bowlers</p>
            {bowlers.slice(0, 3).map((p, i) => (
              <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                <span className="text-[10px] font-bold text-indigo-950 uppercase truncate max-w-[80px]">{getPName(p.uid, p.name)}</span>
                <span className="text-[10px] font-black text-indigo-600">{p.wickets}<span className="text-[8px] text-slate-400 ml-1">({Math.floor(p.bowlingBalls / 6)}.{p.bowlingBalls % 6})</span></span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const PlayerSelector = ({ label, selectedUid, onSelect, players = [] }: any) => {
  const selectedPlayer = players.find((p: any) => p.uid === selectedUid);
  
  return (
    <div className="space-y-1.5 w-full">
      <Label className="text-[10px] font-black text-indigo-900/60 uppercase tracking-widest pl-1">{label}</Label>
      <Select value={selectedUid || ""} onValueChange={onSelect}>
        <SelectTrigger className="bg-slate-50 border-slate-100 text-indigo-950 h-12 rounded-2xl w-full flex justify-between px-4">
          <span className="truncate">{selectedPlayer ? selectedPlayer.displayName : `Assign ${label}`}</span>
        </SelectTrigger>
        <SelectContent className="bg-white border-slate-100 text-indigo-950 min-w-[200px] z-[100] rounded-2xl shadow-2xl">
          {players.map((p: any) => (
            <SelectItem key={p.uid} value={p.uid} className="text-xs font-bold italic uppercase py-3 cursor-pointer hover:bg-slate-50">
              {p.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};


const BattingPlayers = (match: Match, t1p: UserProfile[], t2p: UserProfile[]) => {
  const players = match.innings[match.currentInnings].battingTeamId === match.team1Id ? t1p : t2p;
  const currentInnings = match.innings[match.currentInnings];
  return players.filter(p => !currentInnings.playerStats[p.uid]?.isOut);
};

const BowlingPlayers = (match: Match, t1p: UserProfile[], t2p: UserProfile[]) => {
  const players = match.innings[match.currentInnings].bowlingTeamId === match.team1Id ? t1p : t2p;
  const currentInnings = match.innings[match.currentInnings];
  const lastBowlerUid = match.lastBowlerUid;
  
  // If single player team, they can bowl all overs
  if (match.playersPerTeam === 1) return players;

  const maxOversPerBowler = Math.ceil((match.overs || 0) / 4) || 2; 
  
  return players.filter(p => {
    // 1. Cannot bowl consecutive overs if more than 1 player in team
    if (players.length > 1 && p.uid === lastBowlerUid) return false;

    // 2. Max overs limit
    const stats = currentInnings.playerStats[p.uid];
    if (!stats) return true;
    const oversBowled = Math.floor(stats.bowlingBalls / 6);
    return oversBowled < maxOversPerBowler;
  });
};

const TossCard = ({ match, teamNames, tossStep, setTossStep, localTossWinner, setLocalTossWinner, handleTossDecision }: any) => (
  <Card className="border-0 shadow-lg shadow-slate-200/50 bg-white rounded-[2rem] p-10 text-center space-y-10 animate-in fade-in zoom-in duration-700">
    <div className="space-y-3">
      <div className="w-16 h-16 bg-indigo-50 text-indigo-900 rounded-full flex items-center justify-center mx-auto border-2 border-indigo-100/50">
        <RotateCcw className="w-8 h-8" />
      </div>
      <div className="space-y-1">
        <h3 className="text-3xl font-black text-indigo-950 italic tracking-tighter uppercase">Match Toss</h3>
        <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.4em]">Official Decision</p>
      </div>
    </div>

    {tossStep === 1 ? (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <p className="text-indigo-950/60 font-black italic uppercase text-xs tracking-widest px-8">Select the team that won the coin toss</p>
        <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
          <Button 
            onClick={() => { setLocalTossWinner(match.team1Id); setTossStep(2); }}
            className="h-20 bg-slate-50 border-2 border-transparent hover:border-indigo-900 text-indigo-950 font-black italic rounded-2xl transition-all hover:bg-white hover:shadow-xl shadow-slate-200 group"
          >
            <span className="group-hover:scale-110 transition-transform">{teamNames[1]}</span>
          </Button>
          <Button 
            onClick={() => { setLocalTossWinner(match.team2Id); setTossStep(2); }}
            className="h-20 bg-slate-50 border-2 border-transparent hover:border-indigo-900 text-indigo-950 font-black italic rounded-2xl transition-all hover:bg-white hover:shadow-xl shadow-slate-200 group"
          >
            <span className="group-hover:scale-110 transition-transform">{teamNames[2]}</span>
          </Button>
        </div>
      </div>
    ) : (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <p className="text-indigo-600 font-extrabold italic uppercase text-lg tracking-tight">
            🎉 {localTossWinner === match.team1Id ? teamNames[1] : teamNames[2]}
          </p>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Won the toss and chooses to:</p>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
          <Button 
            onClick={() => handleTossDecision("bat")}
            className="h-24 bg-emerald-600 hover:bg-emerald-700 text-white font-black italic rounded-3xl transition-all shadow-xl shadow-emerald-200 flex flex-col gap-1 items-center justify-center pt-2"
          >
            <Gavel className="w-5 h-5 mb-1" />
            <span className="text-sm">BAT</span>
          </Button>
          <Button 
            onClick={() => handleTossDecision("bowl")}
            className="h-24 bg-indigo-900 hover:bg-indigo-950 text-white font-black italic rounded-3xl transition-all shadow-xl shadow-indigo-200 flex flex-col gap-1 items-center justify-center pt-2"
          >
            <Circle className="w-5 h-5 mb-1" />
            <span className="text-sm">BOWL</span>
          </Button>
        </div>
        <button onClick={() => setTossStep(1)} className="text-slate-400 uppercase text-[10px] font-black hover:text-indigo-900 transition-colors">← Back to selection</button>
      </div>
    )}
  </Card>
);
