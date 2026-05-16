import { useState, useEffect, useCallback, cloneElement } from "react";
import { 
  Trophy, 
  Settings, 
  User as UserIcon, 
  ChevronRight,
  CheckCircle2,
  LogOut,
  Users,
  Search,
  Plus,
  LayoutGrid,
  Shield,
  Calendar,
  X,
  Camera,
  Filter,
  Bell,
  Clock,
  Check,
  UserPlus,
  Send,
  MapPin,
  Trophy as TrophyIcon,
  Pencil,
  Play,
  Crown,
  Medal,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PlayerIDCard } from "./components/PlayerIDCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import { UserProfile, Team, Tournament, BallEvent, Match, JoinRequest } from "./types";
import { finalizeMatchStats, recalculateAllStats } from "./services/matchService";

// Firebase Imports
import { 
  handleFirestoreError,
  OperationType,
  auth, 
  db, 
  onAuthStateChanged, 
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  addDoc,
  deleteDoc,
  arrayUnion,
  generatePlayerId,
  getDocFromServer,
  collectionGroup
} from "./firebase";

import { TournamentCreator } from "./components/TournamentCreator";
import { TournamentDashboard } from "./components/TournamentDashboard";
import { MatchScorer } from "./components/MatchScorer";
import { PlayerPerformance } from "./components/PlayerPerformance";
import { TeamPerformance } from "./components/TeamPerformance";
import { Leaderboard } from "./components/Leaderboard";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { v4 as uuidv4 } from "uuid";

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "tournaments" | "leaderboard" | "search" | "profile">("home");
  const [guestName, setGuestName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserProfile["role"] | null>(null);
  const [loginId, setLoginId] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedId, setGeneratedId] = useState("");
  const [specialization, setSpecialization] = useState<UserProfile["specialization"]>("batter");
  const [playerRoles, setPlayerRoles] = useState<string[]>([]);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [activeStandaloneMatchId, setActiveStandaloneMatchId] = useState<string | null>(null);
  const [showStandaloneSetup, setShowStandaloneSetup] = useState(false);
  
  const [standaloneConfig, setStandaloneConfig] = useState({
    team1Id: "",
    team2Id: "",
    team1Mode: "select" as "select" | "create",
    team2Mode: "select" as "select" | "create",
    newTeam1Name: "",
    newTeam2Name: "",
    newPlayers1: [] as { name: string, role: "batter" | "bowler" | "all-rounder" }[],
    newPlayers2: [] as { name: string, role: "batter" | "bowler" | "all-rounder" }[],
    overs: 5,
    playersPerTeam: 11
  });

  const [tempPlayer, setTempPlayer] = useState({ name: "", role: "batter" as "batter" | "bowler" | "all-rounder" });

  const [registering, setRegistering] = useState(false);
  
  const [isManagingPlayers, setIsManagingPlayers] = useState(false);
  const [isManagingSquad, setIsManagingSquad] = useState(false);
  
  // Data States
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<"players" | "teams" | "tournaments" | "matches">("players");
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  
  const [newTeam, setNewTeam] = useState({
    name: "",
    type: "Club" as "Village" | "City" | "Club"
  });
  const [teamNameInput, setTeamNameInput] = useState("");
  const [invitePlayerId, setInvitePlayerId] = useState("");
  
  // --- Data Sync & Automatic Tasks ---

  useEffect(() => {
    if (players.length > 0) {
      const legacySearchTerms = ["Virat", "Babar", "Buttler", "Shaheen", "Rashid"];
      const toDelete = players.filter(p => 
        legacySearchTerms.some(term => p.displayName.toLowerCase().includes(term.toLowerCase()))
      );
      if (toDelete.length > 0) {
        toDelete.forEach(async (p) => {
          try {
            await deleteDoc(doc(db, "users", p.uid));
            console.log(`Auto-purged legendary account: ${p.displayName}`);
          } catch (e) {
            // Silently fail or log
          }
        });
      }
    }
  }, [players]);

  useEffect(() => {
    // Throttled connection test to avoid spamming errors during initial socket negotiation
    const testConnection = async () => {
      try {
        // Wait a bit for the background connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        const isOffline = error?.message?.includes('the client is offline') || error?.code === 'unavailable';
        if (isOffline) {
          console.warn("Firestore is operating in offline mode. This is often transient.");
        }
      }
    };
    testConnection();

    const sessionUid = sessionStorage.getItem("cric_active_uid");
    if (sessionUid) {
      getDoc(doc(db, "users", sessionUid)).then(docSnap => {
        if (docSnap.exists()) {
          setUser(docSnap.data() as UserProfile);
          setLoading(false);
        }
      });
    }

    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      const sessionUid = sessionStorage.getItem("cric_active_uid");
      if (sessionUid) {
        const userDoc = await getDoc(doc(db, "users", sessionUid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserProfile);
          setLoading(false);
          return;
        }
      }
      if (fUser) {
        const userDoc = await getDoc(doc(db, "users", fUser.uid));
        if (userDoc.exists()) setUser(userDoc.data() as UserProfile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // --- Data Listeners ---

  useEffect(() => {
    if (!user) return;
    const playersUnsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const allPlayers = snapshot.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
      // Deduplicate by UID just in case
      const uniquePlayers = Array.from(new Map(allPlayers.map(p => [p.uid, p])).values());
      setPlayers(uniquePlayers.filter(p => p.role === "player"));
    }, (error) => handleFirestoreError(error, OperationType.GET, "users"));

    const teamsUnsub = onSnapshot(collection(db, "teams"), (snapshot) => {
      setTeams(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Team)));
    }, (error) => handleFirestoreError(error, OperationType.GET, "teams"));

    const tournamentsUnsub = onSnapshot(collection(db, "tournaments"), (snapshot) => {
      setTournaments(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Tournament)));
    }, (error) => handleFirestoreError(error, OperationType.GET, "tournaments"));

    const matchesUnsub = onSnapshot(collectionGroup(db, "matches"), (snapshot) => {
      setMatches(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Match)));
    }, (error) => handleFirestoreError(error, OperationType.GET, "matches_group"));

    const requestsUnsub = user ? onSnapshot(query(collection(db, "requests"), 
      where("toUid", "==", user.uid), 
      where("status", "==", "pending")), (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as JoinRequest)));
    }, (error) => handleFirestoreError(error, OperationType.GET, "requests")) : () => {};

    return () => { playersUnsub(); teamsUnsub(); tournamentsUnsub(); matchesUnsub(); requestsUnsub(); };
  }, [user]);

  const handleLogin = async () => {
    const rawId = loginId.trim();
    if (!rawId) return toast.error("Enter Unique ID");
    
    setLoading(true);
    try {
      console.log("Attempting login with ID:", rawId);
      
      // 1. Try to find by playerUniqueId (The CRIC-XXXXXX ID)
      const q = query(collection(db, "users"), where("playerUniqueId", "==", rawId.toUpperCase()));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const userData = snap.docs[0].data() as UserProfile;
        console.log("Found user via Unique ID:", userData.uid);
        sessionStorage.setItem("cric_active_uid", userData.uid);
        setUser(userData);
        toast.success(`Welcome back, ${userData.displayName}!`);
        return;
      }
      
      // 2. Fallback: Try to find by direct UID (case sensitive)
      const directDoc = await getDoc(doc(db, "users", rawId));
      if (directDoc.exists()) {
        const userData = directDoc.data() as UserProfile;
        console.log("Found user via Direct UID:", userData.uid);
        sessionStorage.setItem("cric_active_uid", userData.uid);
        setUser(userData);
        toast.success(`Welcome back, ${userData.displayName}!`);
        return;
      }
      
      console.warn("No user found for ID:", rawId);
      toast.error("Invalid ID. Please check and try again.");
    } catch (e) { 
      console.error("Login Error:", e);
      toast.error("Login failed. Check your network."); 
    } finally {
      setLoading(false);
    }
  };

  const registerRole = async () => {
    if (!guestName.trim() || !selectedRole) return toast.error("Missing fields");
    if (profileImage && profileImage.length > 800000) {
      return toast.error("Photo is too large. Please use a smaller image or a URL.");
    }
    setRegistering(true);
    const uniqueId = generatePlayerId();
    const customUid = `user_${Math.random().toString(36).substr(2, 9)}`;
    const profile: UserProfile = {
      uid: customUid,
      displayName: guestName.trim(),
      email: `${guestName.toLowerCase().replace(/\s+/g, ".")}@guest.com`,
      role: selectedRole,
      playerUniqueId: uniqueId,
      photoURL: profileImage || null,
      specialization: selectedRole === "player" ? (specialization || "batter") : null,
      stats: { matches: 0, runs: 0, balls: 0, wickets: 0, fours: 0, sixes: 0, fifties: 0, centuries: 0, bowlingRuns: 0, bowlingBalls: 0 }
    };
    console.log("Attempting registration:", profile);
    try {
      await setDoc(doc(db, "users", profile.uid), { ...profile, createdAt: serverTimestamp() });
      console.log("Registration successful for UID:", profile.uid);
      sessionStorage.setItem("cric_active_uid", profile.uid);
      setGeneratedId(uniqueId);
      // Automatically log in the user after registration
      setUser(profile);
      setShowSuccessModal(true);
    } catch (e) {
      console.error("Registration error:", e);
      toast.error("Registration failed. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  const togglePlaying11 = async (teamId: string, playerUid: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    const currentPlaying11 = team.playing11Ids || [];
    let updatedPlaying11;
    
    if (currentPlaying11.includes(playerUid)) {
      updatedPlaying11 = currentPlaying11.filter(id => id !== playerUid);
    } else {
      if (currentPlaying11.length >= 11) {
        return toast.error("Maximum 11 players allowed in the lineup");
      }
      updatedPlaying11 = [...currentPlaying11, playerUid];
    }
    
    try {
      await updateDoc(doc(db, "teams", teamId), { playing11Ids: updatedPlaying11 });
    } catch (e) {
      toast.error("Failed to update lineup");
    }
  };

  const setLeaderRole = async (teamId: string, playerUid: string, leaderRole: "captain" | "viceCaptain") => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      const updateData: any = {};
      if (leaderRole === "captain") {
        updateData.captainId = team.captainId === playerUid ? null : playerUid;
      } else {
        updateData.viceCaptainId = team.viceCaptainId === playerUid ? null : playerUid;
      }
      
      await updateDoc(doc(db, "teams", teamId), updateData);
      toast.success(updateData[leaderRole + "Id"] === null ? "Role removed" : `${leaderRole === "captain" ? "Captain" : "Vice-Captain"} appointed`);
    } catch (e) {
      toast.error("Failed to assign leader");
    }
  };

  const updatePlayerRoles = async (targetUid: string, role: string) => {
    try {
      const p = players.find(player => player.uid === targetUid);
      if (!p) return;
      const currentRoles = p.roles || [];
      const updatedRoles = currentRoles.includes(role) 
        ? currentRoles.filter(r => r !== role)
        : [...currentRoles, role];
      
      await updateDoc(doc(db, "users", targetUid), { roles: updatedRoles });
    } catch (e) {
      toast.error("Failed to update player roles");
    }
  };

  const createTeam = async () => {
    if (!user || user.role !== "manager" || !newTeam.name.trim()) return;
    const teamRef = doc(collection(db, "teams"));
    await setDoc(teamRef, {
      id: teamRef.id,
      name: newTeam.name.trim(),
      teamId: `T-${Math.floor(1000 + Math.random() * 9000)}`,
      managerUid: user.uid,
      playerIds: [],
      type: newTeam.type,
      createdAt: serverTimestamp()
    });
    setNewTeam({ name: "", type: "Club" });
    toast.success("Team created!");
  };

  const updateTeamName = async (teamId: string, newName: string) => {
    if (!newName.trim()) return toast.error("Name cannot be empty");
    try {
      await updateDoc(doc(db, "teams", teamId), { name: newName });
      toast.success("Team name updated!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update name");
    }
  };

  const joinTournament = async (tournamentId: string) => {
    if (!user) return;
    const team = teams.find(t => t.managerUid === user.uid);
    if (!team) return toast.error("You need a team first");
    
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (tournament && !tournament.teamIds?.includes(team.id)) {
      if (user.role === "manager") {
        // Send request to arranger
        await sendJoinRequest(tournament.arrangerUid, team.id, "team_to_tournament", tournamentId);
      } else if (user.role === "arranger" && tournament.arrangerUid === user.uid) {
        // Direct add if arranger (e.g. from search)
        await updateDoc(doc(db, "tournaments", tournamentId), {
          teamIds: arrayUnion(team.id)
        });
        await updateDoc(doc(db, "teams", team.id), { tournamentId });
        toast.success("Team added to tournament!");
      }
    }
  };

  const sendJoinRequest = async (targetId: string, teamId?: string, type: "player_to_team" | "manager_to_player" | "team_to_tournament" | "tournament_to_team" = "player_to_team", tournamentId?: string) => {
    if (!user) return toast.error("Please login first");
    
    // Check if request already exists
    const existing = requests.find(r => r.fromUid === user.uid && r.toUid === targetId && (teamId ? r.teamId === teamId : true) && (tournamentId ? r.tournamentId === tournamentId : true));
    if (existing) return toast.error("Request already pending");

    try {
      const newRequest: Omit<JoinRequest, 'id'> = {
        fromUid: user.uid,
        fromName: user.displayName,
        toUid: targetId,
        teamId: teamId || "",
        tournamentId: tournamentId || "",
        status: "pending",
        type,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, "requests"), newRequest);
      toast.success("Request sent!");
    } catch (e) { toast.error("Failed to send request"); }
  };

  const handleInviteById = async () => {
    if (!invitePlayerId.trim()) return toast.error("Enter Player Unique ID");
    
    const team = teams.find(t => t.managerUid === user?.uid);
    if (!team) return toast.error("You don't have a team");

    const targetPlayer = players.find(p => p.playerUniqueId?.toUpperCase() === invitePlayerId.trim().toUpperCase());
    
    if (!targetPlayer) return toast.error("Player not found with this ID");
    if (team.playerIds?.includes(targetPlayer.uid)) return toast.info("Player is already in your team");

    await sendJoinRequest(targetPlayer.uid, team.id, "manager_to_player");
    setInvitePlayerId("");
  };

  const removePlayer = async (playerId: string) => {
    if (!user || user.role !== "manager") return;
    const team = teams.find(t => t.managerUid === user.uid);
    if (!team) return;

    try {
      const teamRef = doc(db, "teams", team.id);
      const newPlayerIds = team.playerIds?.filter(id => id !== playerId) || [];
      await updateDoc(teamRef, { playerIds: newPlayerIds });
      toast.success("Player removed from squad");
    } catch (e) {
      toast.error("Failed to remove player");
    }
  };

  const respondToRequest = async (request: JoinRequest, status: "accepted" | "declined") => {
    try {
      const reqRef = doc(db, "requests", request.id);
      await updateDoc(reqRef, { status });

      if (status === "accepted") {
        if (request.type === "player_to_team" || request.type === "manager_to_player") {
          if (!request.teamId) throw new Error("Team ID missing");
          const teamRef = doc(db, "teams", request.teamId);
          const targetUid = request.type === "player_to_team" ? request.fromUid : request.toUid;
          await updateDoc(teamRef, { playerIds: arrayUnion(targetUid) });
          toast.success("Player added to team!");
        } else if (request.type === "team_to_tournament" || request.type === "tournament_to_team") {
          if (!request.tournamentId || !request.teamId) throw new Error("Tournament or Team ID missing");
          const tournamentRef = doc(db, "tournaments", request.tournamentId);
          const teamRef = doc(db, "teams", request.teamId);
          
          await updateDoc(tournamentRef, { teamIds: arrayUnion(request.teamId) });
          await updateDoc(teamRef, { tournamentId: request.tournamentId });
          toast.success("Team added to tournament!");
        }
      } else {
        toast.info("Request declined");
      }
    } catch (e) { toast.error("Operation failed"); }
  };

  const deleteTournament = async (tournamentId: string) => {
    if (!user || user.role !== "arranger") return;
    const t = tournaments.find(tour => tour.id === tournamentId);
    if (!t) return;
    
    // User asked to be able to delete even if completed/mistakenly created
    const warning = t.status === "ongoing" 
      ? "Tournament is ongoing. Are you sure you want to delete it? This will remove it from dashboards."
      : "Are you sure you want to delete this tournament? This cannot be undone.";

    if (!confirm(warning)) return;

    try {
      const toastId = toast.loading("Deleting tournament...");
      await updateDoc(doc(db, "tournaments", tournamentId), { 
        arrangerUid: "deleted_" + user.uid, 
        status: "deleted",
        deletedAt: serverTimestamp() 
      });
      toast.dismiss(toastId);
      toast.success("Tournament removed");
      setSelectedTournamentId(null); // Return home if we were inside it
    } catch (e) {
      toast.error("Failed to delete tournament");
    }
  };

  const deleteMatch = async (matchId: string, tournamentId: string) => {
    if (!user || user.role !== "arranger") return;
    const m = matches.find(match => match.id === matchId);
    if (!m) return;

    if (!confirm("Remove this match?")) return;

    try {
      const toastId = toast.loading("Removing match...");
      if (tournamentId === "standalone") {
        await updateDoc(doc(db, "matches", matchId), { 
          arrangerUid: "deleted_" + user.uid, 
          status: "deleted",
          deletedAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, "tournaments", tournamentId, "matches", matchId), { status: "deleted" });
      }
      toast.dismiss(toastId);
      toast.success("Match removed");
    } catch (e) {
      toast.error("Failed to delete match");
    }
  };

  const forceCompleteMatch = async (matchId: string, tournamentId: string) => {
    if (!user || user.role !== "arranger") return;
    const m = matches.find(match => match.id === matchId);
    if (!m) return toast.error("Match not found");
    
    const confirmMsg = m.status === "live" 
      ? "Match is in progress. Mark as Completed (Drawn)? Stats will be saved."
      : "Mark this scheduled match as Completed (Drawn)?";

    if (!confirm(confirmMsg)) return;

    try {
      const toastId = toast.loading("Completing match...");
      const updateData = { 
        status: "completed", 
        winnerId: "tie",
        completedAt: serverTimestamp(),
        manuallyCompletedBy: user.uid
      };

      if (tournamentId === "standalone") {
        await updateDoc(doc(db, "matches", matchId), updateData);
      } else {
        await updateDoc(doc(db, "tournaments", tournamentId, "matches", matchId), updateData);
      }

      await finalizeMatchStats(m, tournamentId, "tie");
      toast.dismiss(toastId);
      toast.success("Match completed as Draw");
    } catch (e) {
      toast.error("Failed to complete match");
    }
  };

  const createQuickMatch = async () => {
    let finalTeam1Id = standaloneConfig.team1Id;
    let finalTeam2Id = standaloneConfig.team2Id;

    setLoading(true);
    try {
      // Helper to create team and players
      const prepareTeam = async (mode: "select" | "create", existingId: string, manualName: string, manualPlayers: { name: string, role: string }[]) => {
        let teamId = existingId;
        const playerUids: string[] = [];

        // Create manual players
        for (const pData of manualPlayers) {
          const playerUid = `user_auto_${uuidv4().substring(0, 8)}`;
          const uniqueId = generatePlayerId();
          const playerProfile: UserProfile = {
            uid: playerUid,
            displayName: pData.name,
            email: `${pData.name.toLowerCase().replace(/\s+/g, ".")}@system.com`,
            role: "player",
            playerUniqueId: uniqueId,
            specialization: pData.role as "batter" | "bowler" | "all-rounder",
            stats: { matches: 0, runs: 0, balls: 0, wickets: 0, fours: 0, sixes: 0, fifties: 0, centuries: 0, bowlingRuns: 0, bowlingBalls: 0 }
          };
          await setDoc(doc(db, "users", playerUid), { ...playerProfile, createdAt: serverTimestamp() });
          playerUids.push(playerUid);
        }

        if (mode === "select") {
          if (playerUids.length > 0) {
            const teamRef = doc(db, "teams", teamId);
            await updateDoc(teamRef, { playerIds: arrayUnion(...playerUids) });
          }
          return teamId;
        } else {
          // Create new team
          const teamRef = doc(collection(db, "teams"));
          teamId = teamRef.id;

          const teamData: Team = {
            id: teamId,
            name: manualName,
            teamId: `T-AUTO-${Math.floor(1000 + Math.random() * 9000)}`,
            managerUid: user!.uid,
            playerIds: playerUids,
            type: "Club"
          };
          await setDoc(teamRef, teamData);
          return teamId;
        }
      };

      finalTeam1Id = await prepareTeam(standaloneConfig.team1Mode, standaloneConfig.team1Id, standaloneConfig.newTeam1Name, standaloneConfig.newPlayers1);
      finalTeam2Id = await prepareTeam(standaloneConfig.team2Mode, standaloneConfig.team2Id, standaloneConfig.newTeam2Name, standaloneConfig.newPlayers2);

      if (!finalTeam1Id || !finalTeam2Id) throw new Error("Team selection mismatch");
      if (finalTeam1Id === finalTeam2Id) throw new Error("Select different teams");

      // We need to fetch the team names again for the match name if they were just created
      // But we can just use the config names if available.
      const t1Name = standaloneConfig.team1Mode === "create" ? standaloneConfig.newTeam1Name : teams.find(t => t.id === finalTeam1Id)?.name;
      const t2Name = standaloneConfig.team2Mode === "create" ? standaloneConfig.newTeam2Name : teams.find(t => t.id === finalTeam2Id)?.name;

      const matchId = uuidv4();
      const newMatch: Match = {
        id: matchId,
        tournamentId: "standalone",
        stageId: "standalone",
        name: `Friendly: ${t1Name} vs ${t2Name}`,
        team1Id: finalTeam1Id,
        team2Id: finalTeam2Id,
        status: "live",
        overs: standaloneConfig.overs,
        playersPerTeam: standaloneConfig.playersPerTeam,
        currentInnings: 1,
        arrangerUid: user!.uid,
        innings: {
          1: { battingTeamId: finalTeam1Id, bowlingTeamId: finalTeam2Id, runs: 0, wickets: 0, balls: 0, history: [], playerStats: {} },
          2: { battingTeamId: finalTeam2Id, bowlingTeamId: finalTeam1Id, runs: 0, wickets: 0, balls: 0, history: [], playerStats: {} }
        }
      };

      await setDoc(doc(db, "matches", matchId), newMatch);
      setActiveStandaloneMatchId(matchId);
      setShowStandaloneSetup(false);
      toast.success("Quick Match Started!");
    } catch (e: any) {
      toast.error(e.message || "Failed to start match");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-black italic animate-pulse">CRICSCORE LOADING...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
        <Toaster position="top-center" richColors />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.15),transparent)] pointer-events-none" />
        
        <div className="max-w-md w-full space-y-8 relative z-10">
          <div className="text-center space-y-4">
            <Trophy className="w-20 h-20 text-indigo-500 mx-auto drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            <h1 className="text-5xl font-black italic tracking-tighter">CRICSCORE <span className="text-indigo-400">PRO</span></h1>
          </div>

          <Card className="bg-white/5 border-white/10 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl">
            {!showLogin ? (
              <div className="space-y-6">
                <Input placeholder="Your Name" value={guestName} onChange={e => setGuestName(e.target.value)} className="bg-slate-900 border-white/10 text-white h-12 rounded-xl" />
                <div className="space-y-2">
                  <Input placeholder="Photo URL (Optional)" value={profileImage || ""} onChange={e => setProfileImage(e.target.value)} className="bg-slate-900 border-white/10 text-white h-12 rounded-xl" />
                  <div className="flex items-center gap-2 px-1">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-[8px] font-black text-slate-600 uppercase">OR</span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setProfileImage(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} 
                    className="bg-slate-900 border-white/10 text-white h-10 rounded-xl text-[10px] file:bg-indigo-600 file:border-0 file:text-white file:font-bold file:px-3 file:py-1 file:rounded-lg file:mr-3 hover:file:bg-indigo-700 cursor-pointer" 
                  />
                </div>
                
                {selectedRole === "player" && (
                  <div className="flex gap-2">
                    {["batter", "bowler", "all-rounder"].map(spec => (
                      <Button 
                        key={spec}
                        variant={specialization === spec ? "default" : "outline"}
                        onClick={() => setSpecialization(spec as any)}
                        size="sm"
                        className={`flex-1 h-10 rounded-xl font-bold italic text-[9px] uppercase ${specialization === spec ? 'bg-indigo-600' : 'bg-transparent border-white/10 text-slate-500'}`}
                      >
                        {spec}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {["player", "manager", "arranger"].map(role => (
                    <Button 
                      key={role}
                      variant={selectedRole === role ? "default" : "outline"}
                      onClick={() => setSelectedRole(role as any)}
                      className={`h-16 rounded-xl font-black italic text-xs uppercase ${selectedRole === role ? 'bg-indigo-600' : 'bg-transparent border-white/10 text-slate-400'}`}
                    >
                      {role}
                    </Button>
                  ))}
                </div>
                <Button 
                  onClick={registerRole} 
                  disabled={registering}
                  className="w-full h-14 bg-white text-black font-black italic text-lg rounded-2xl hover:bg-slate-200 disabled:opacity-50"
                >
                  {registering ? "REGISTERING..." : "Register"}
                </Button>
                <Button variant="link" onClick={() => setShowLogin(true)} className="w-full text-slate-500 text-xs">Already have an ID? Login</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <Input placeholder="Unique ID (CRIC-XXXXXX)" value={loginId} onChange={e => setLoginId(e.target.value)} className="bg-slate-900 border-white/10 text-white h-12 rounded-xl uppercase" />
                <Button onClick={handleLogin} className="w-full h-14 bg-indigo-600 text-white font-black italic text-lg rounded-2xl">Login</Button>
                <Button variant="link" onClick={() => setShowLogin(false)} className="w-full text-slate-500 text-xs text-center">Back to Registration</Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30">
      <Toaster position="top-center" theme="dark" />

      {/* Global Header */}
      <header className="fixed top-0 left-0 right-0 z-[50] h-20 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
          <h1 className="text-xl font-black italic tracking-tighter">CRICSCORE <span className="text-indigo-400">PRO</span></h1>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <Dialog>
              <DialogTrigger render={<Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 text-white relative hover:bg-white/10 transition-all" />}>
                <Bell className="w-5 h-5" />
                {requests.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 border-2 border-slate-950 rounded-full flex items-center justify-center text-[10px] font-black animate-bounce">{requests.length}</span>}
              </DialogTrigger>
              <DialogContent className="bg-slate-950 border-white/10 text-white rounded-[2.5rem] shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Center of Actions</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                  {requests.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 space-y-2">
                       <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                          <Clock className="w-6 h-6" />
                       </div>
                       <p className="text-xs font-medium italic">No pending actions required</p>
                    </div>
                  ) : (
                    requests.map(req => (
                      <Card key={req.id} className="bg-slate-900 border-white/5 p-4 flex items-center gap-4 hover:border-white/10 transition-all">
                         <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center font-black text-indigo-400 italic">
                           {req.fromName[0]}
                         </div>
                         <div className="flex-1">
                            <div className="text-xs font-black text-white italic uppercase tracking-tight">{req.fromName}</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                              {req.type === "player_to_team" && "Wants to join your team"}
                              {req.type === "manager_to_player" && "Invited you to their team"}
                              {req.type === "team_to_tournament" && "Team wants to join tournament"}
                              {req.type === "tournament_to_team" && "Invited your team to tournament"}
                            </div>
                         </div>
                         <div className="flex gap-2">
                            <Button onClick={() => respondToRequest(req, "accepted")} size="icon" className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"><Check className="w-4 h-4" /></Button>
                            <Button onClick={() => respondToRequest(req, "declined")} size="icon" className="w-8 h-8 rounded-full bg-slate-800 hover:bg-red-900 shadow-lg"><X className="w-4 h-4" /></Button>
                         </div>
                      </Card>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
          {user && (
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{user.role}</div>
                <div className="text-xs font-bold text-white italic uppercase leading-none">{user.displayName}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white italic overflow-hidden">
                {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : user.displayName[0]}
              </div>
            </div>
          )}
        </div>
      </header>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="rounded-3xl max-w-sm border-white/10 bg-slate-900 text-white shadow-2xl">
          <div className="text-center space-y-6 py-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            <h2 className="text-2xl font-black italic tracking-tighter">Registration Complete!</h2>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
              <span className="text-[10px] font-black text-slate-500 uppercase">Your Unique ID</span>
              <div className="text-3xl font-black text-indigo-400 tracking-wider my-2">{generatedId}</div>
              <Button variant="ghost" className="text-xs text-slate-400" onClick={() => navigator.clipboard.writeText(generatedId)}>Copy ID</Button>
            </div>
            <Button onClick={() => setShowSuccessModal(false)} className="w-full h-12 bg-indigo-600 rounded-xl font-black italic">Go to Dashboard</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 flex gap-1 z-50 shadow-2xl">
        <NavButton active={activeTab === "home"} onClick={() => { setActiveTab("home"); setSelectedTournamentId(null); setShowCreator(false); }} icon={<LayoutGrid />} label="Home" />
        <NavButton active={activeTab === "tournaments"} onClick={() => setActiveTab("tournaments")} icon={<Trophy />} label="Events" />
        <NavButton active={activeTab === "leaderboard"} onClick={() => setActiveTab("leaderboard")} icon={<Crown />} label="Stats" />
        <NavButton active={activeTab === "search"} onClick={() => setActiveTab("search")} icon={<Search />} label="Find" />
        <NavButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")} icon={<UserIcon />} label="Profile" />
      </nav>

      <main className="pb-32 pt-24">
        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div 
              key="tab-home"
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto px-4 space-y-8"
            >
              {/* Profile Card Header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Logged in as {user.role}</span>
                  <h2 className="text-3xl font-black italic tracking-tighter">HELLO, {user.displayName.toUpperCase()}!</h2>
                </div>
                <Button variant="ghost" onClick={() => { sessionStorage.removeItem("cric_active_uid"); window.location.reload(); }} className="text-slate-500"><LogOut className="w-5 h-5" /></Button>
              </div>

              {/* Tournament Dashboard or Creation */}
              {user.role === "arranger" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black italic text-indigo-400">My Tournaments</h3>
                    <div className="flex gap-2">
                       <Dialog open={showStandaloneSetup} onOpenChange={setShowStandaloneSetup}>
                         <DialogTrigger render={<Button className="bg-white text-black rounded-xl h-8 text-xs font-bold gap-2 hover:bg-slate-200 transition-all"><Play className="w-3.5 h-3.5 fill-black" /> Start Match</Button>} />
                         <DialogContent className="bg-slate-950 border-white/10 text-white rounded-[2rem] max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide">
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase text-indigo-400">Quick Match Setup</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-8 py-6">
                               {/* Team 1 Section */}
                               <div className="space-y-4">
                                 <Label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] px-1">Team 1 (Batting First?)</Label>
                                 <Tabs value={standaloneConfig.team1Mode} onValueChange={(v: any) => setStandaloneConfig({...standaloneConfig, team1Mode: v})}>
                                    <TabsList className="bg-white/5 border border-white/5 w-full h-10 rounded-xl p-1">
                                       <TabsTrigger value="select" className="flex-1 rounded-lg text-[10px] font-black uppercase italic">Existing</TabsTrigger>
                                       <TabsTrigger value="create" className="flex-1 rounded-lg text-[10px] font-black uppercase italic">New Team</TabsTrigger>
                                    </TabsList>
                                    <div className="mt-4 space-y-4">
                                       {standaloneConfig.team1Mode === "select" ? (
                                         <Select value={standaloneConfig.team1Id} onValueChange={(v) => setStandaloneConfig({...standaloneConfig, team1Id: v})}>
                                           <SelectTrigger className="bg-white/5 border-white/5 h-12 rounded-xl text-white">
                                             <SelectValue placeholder="Select Team 1" />
                                           </SelectTrigger>
                                           <SelectContent className="bg-slate-900 border-white/10 text-white">
                                             {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.teamId})</SelectItem>)}
                                           </SelectContent>
                                         </Select>
                                       ) : (
                                         <Input 
                                           placeholder="New Team Name" 
                                           value={standaloneConfig.newTeam1Name}
                                           onChange={e => setStandaloneConfig({...standaloneConfig, newTeam1Name: e.target.value})}
                                           className="bg-white/5 border-white/5 h-12 rounded-xl text-white"
                                         />
                                       )}
                                       
                                       <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                                          <div className="flex justify-between items-center">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">New Players to Add ({standaloneConfig.newPlayers1.length})</p>
                                            <p className="text-[8px] text-indigo-400/50 font-bold uppercase">Allocates UID & Stats</p>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                             {standaloneConfig.newPlayers1.map((p, i) => (
                                               <Badge key={i} className="bg-indigo-600/20 text-indigo-400 border-indigo-600/20 text-[9px] font-black uppercase italic py-1 group">
                                                 {p.name}
                                                 <X className="w-2.5 h-2.5 ml-1.5 cursor-pointer hover:text-red-500" onClick={() => {
                                                   const next = [...standaloneConfig.newPlayers1];
                                                   next.splice(i, 1);
                                                   setStandaloneConfig({...standaloneConfig, newPlayers1: next});
                                                 }} />
                                               </Badge>
                                             ))}
                                          </div>
                                          <div className="flex gap-2">
                                             <Input 
                                               placeholder="Player Name" 
                                               value={tempPlayer.name}
                                               onChange={e => setTempPlayer({...tempPlayer, name: e.target.value})}
                                               className="bg-slate-900 border-white/5 h-10 rounded-xl text-xs text-white"
                                             />
                                             <Button 
                                              disabled={!tempPlayer.name.trim()}
                                              onClick={() => {
                                                setStandaloneConfig({
                                                  ...standaloneConfig, 
                                                  newPlayers1: [...standaloneConfig.newPlayers1, { ...tempPlayer }]
                                                });
                                                setTempPlayer({ name: "", role: "batter" });
                                              }}
                                              className="h-10 px-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                             >
                                               <Plus className="w-4 h-4" />
                                             </Button>
                                          </div>
                                       </div>
                                    </div>
                                 </Tabs>
                               </div>

                               {/* Team 2 Section */}
                               <div className="space-y-4">
                                 <Label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] px-1">Team 2 (Bowling First?)</Label>
                                 <Tabs value={standaloneConfig.team2Mode} onValueChange={(v: any) => setStandaloneConfig({...standaloneConfig, team2Mode: v})}>
                                    <TabsList className="bg-white/5 border border-white/5 w-full h-10 rounded-xl p-1">
                                       <TabsTrigger value="select" className="flex-1 rounded-lg text-[10px] font-black uppercase italic">Existing</TabsTrigger>
                                       <TabsTrigger value="create" className="flex-1 rounded-lg text-[10px] font-black uppercase italic">New Team</TabsTrigger>
                                    </TabsList>
                                    <div className="mt-4 space-y-4">
                                       {standaloneConfig.team2Mode === "select" ? (
                                         <Select value={standaloneConfig.team2Id} onValueChange={(v) => setStandaloneConfig({...standaloneConfig, team2Id: v})}>
                                           <SelectTrigger className="bg-white/5 border-white/5 h-12 rounded-xl text-white">
                                             <SelectValue placeholder="Select Team 2" />
                                           </SelectTrigger>
                                           <SelectContent className="bg-slate-900 border-white/10 text-white">
                                             {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.teamId})</SelectItem>)}
                                           </SelectContent>
                                         </Select>
                                       ) : (
                                         <Input 
                                           placeholder="New Team Name" 
                                           value={standaloneConfig.newTeam2Name}
                                           onChange={e => setStandaloneConfig({...standaloneConfig, newTeam2Name: e.target.value})}
                                           className="bg-white/5 border-white/5 h-12 rounded-xl text-white"
                                         />
                                       )}
                                       
                                       <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                                          <div className="flex justify-between items-center">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">New Players to Add ({standaloneConfig.newPlayers2.length})</p>
                                            <p className="text-[8px] text-indigo-400/50 font-bold uppercase">Allocates UID & Stats</p>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                             {standaloneConfig.newPlayers2.map((p, i) => (
                                               <Badge key={i} className="bg-indigo-600/20 text-indigo-400 border-indigo-600/20 text-[9px] font-black uppercase italic py-1 group">
                                                 {p.name}
                                                 <X className="w-2.5 h-2.5 ml-1.5 cursor-pointer hover:text-red-500" onClick={() => {
                                                   const next = [...standaloneConfig.newPlayers2];
                                                   next.splice(i, 1);
                                                   setStandaloneConfig({...standaloneConfig, newPlayers2: next});
                                                 }} />
                                               </Badge>
                                             ))}
                                          </div>
                                          <div className="flex gap-2">
                                             <Input 
                                               placeholder="Player Name" 
                                               value={tempPlayer.name}
                                               onChange={e => setTempPlayer({...tempPlayer, name: e.target.value})}
                                               className="bg-slate-900 border-white/5 h-10 rounded-xl text-xs text-white"
                                             />
                                             <Button 
                                              disabled={!tempPlayer.name.trim()}
                                              onClick={() => {
                                                setStandaloneConfig({
                                                  ...standaloneConfig, 
                                                  newPlayers2: [...standaloneConfig.newPlayers2, { ...tempPlayer }]
                                                });
                                                setTempPlayer({ name: "", role: "batter" });
                                              }}
                                              className="h-10 px-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                             >
                                               <Plus className="w-4 h-4" />
                                             </Button>
                                          </div>
                                       </div>
                                    </div>
                                 </Tabs>
                               </div>

                               <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Overs</Label>
                                    <Input 
                                      type="number" 
                                      value={standaloneConfig.overs} 
                                      onChange={(e) => setStandaloneConfig({...standaloneConfig, overs: parseInt(e.target.value) || 1})}
                                      className="bg-white/5 border-white/5 h-12 rounded-xl text-white"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Players/Team</Label>
                                    <Input 
                                      type="number" 
                                      value={standaloneConfig.playersPerTeam} 
                                      onChange={(e) => setStandaloneConfig({...standaloneConfig, playersPerTeam: parseInt(e.target.value) || 11})}
                                      className="bg-white/5 border-white/5 h-12 rounded-xl text-white"
                                    />
                                  </div>
                               </div>
                               <Button onClick={createQuickMatch} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black italic rounded-2xl shadow-2xl shadow-indigo-600/20">LET'S PLAY</Button>
                            </div>
                         </DialogContent>
                       </Dialog>
                       <Button onClick={() => setShowCreator(!showCreator)} className="bg-indigo-600 rounded-xl h-8 text-xs font-bold gap-2">
                         {showCreator ? "Close Creator" : <><Plus className="w-4 h-4" /> Create New</>}
                       </Button>
                    </div>
                  </div>
                  
                  {showCreator ? <TournamentCreator /> : (
                    <div className="space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {tournaments.filter(t => t.arrangerUid === user.uid && t.status !== "deleted").map(t => (
                           <TournamentCard 
                             key={t.id} 
                             tournament={t} 
                             onSelect={() => setSelectedTournamentId(t.id)} 
                             onDelete={() => deleteTournament(t.id)}
                           />
                         ))}
                       </div>

                       {/* Resume Standalone Matches */}
                       {matches.filter(m => m.tournamentId === "standalone" && m.status !== "completed" && m.status !== "deleted" && m.arrangerUid === user.uid).length > 0 && (
                          <div className="space-y-4 mt-8">
                             <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-400" />
                                <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">In Progress Matches</h3>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 {matches.filter(m => m.tournamentId === "standalone" && m.status !== "completed" && m.status !== "deleted" && m.arrangerUid === user.uid).map(m => (
                                   <Card 
                                     key={m.id} 
                                     className="bg-slate-900 border-white/5 p-5 flex flex-col gap-4 group hover:border-indigo-500/50 transition-all overflow-hidden relative"
                                   >
                                     <div className="absolute top-2 right-2 flex gap-2 z-10">
                                       {m.status === "live" && <Badge className="bg-red-600 animate-pulse text-white border-none font-black italic uppercase text-[8px] h-5">LIVE</Badge>}
                                       <Button 
                                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); forceCompleteMatch(m.id, "standalone"); }} 
                                         variant="ghost" 
                                         size="icon" 
                                         className="w-8 h-8 rounded-full bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-all shadow-lg"
                                         title="Mark as Completed"
                                       >
                                         <CheckCircle2 className="w-4 h-4" />
                                       </Button>
                                     </div>
                                     <div onClick={() => setActiveStandaloneMatchId(m.id)} className="cursor-pointer">
                                       <div className="text-[10px] font-black text-slate-300 uppercase italic mb-1 truncate">{m.name}</div>
                                       <div className="flex items-center justify-between gap-4">
                                          <div className="flex-1 text-center">
                                             <div className="text-[10px] font-black text-white italic truncate">{teams.find(t => t.id === m.team1Id)?.name || 'Team 1'}</div>
                                             <div className="text-lg font-black text-indigo-400 italic font-mono">{m.innings[m.currentInnings].runs}/{m.innings[m.currentInnings].wickets}</div>
                                          </div>
                                          <div className="text-slate-500 font-black italic text-xs">VS</div>
                                          <div className="flex-1 text-center">
                                             <div className="text-[10px] font-black text-white italic truncate">{teams.find(t => t.id === m.team2Id)?.name || 'Team 2'}</div>
                                             <div className="text-xs font-black text-slate-400 italic">Target: {(m.innings[1]?.runs || 0) + 1}</div>
                                          </div>
                                       </div>
                                     </div>
                                     <div className="flex gap-2">
                                       <Button onClick={() => setActiveStandaloneMatchId(m.id)} size="sm" className="flex-1 bg-white/5 hover:bg-indigo-600 text-[9px] font-black uppercase italic rounded-xl h-8">Continue Scoring</Button>
                                       <Button 
                                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteMatch(m.id, "standalone"); }} 
                                         variant="ghost" 
                                         size="icon" 
                                         className="w-8 h-8 rounded-xl bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white"
                                       >
                                         <X className="w-4 h-4" />
                                       </Button>
                                     </div>
                                   </Card>
                                ))}
                             </div>
                          </div>
                       )}
                    </div>
                  )}

                  {selectedTournamentId && (
                    <div className="fixed inset-0 bg-slate-950 z-[60] overflow-y-auto pt-10 px-4">
                      <Button variant="ghost" onClick={() => setSelectedTournamentId(null)} className="mb-4 text-white">← Close Board</Button>
                      <TournamentDashboard tournamentId={selectedTournamentId} />
                    </div>
                  )}

                  {activeStandaloneMatchId && (
                    <div className="fixed inset-0 bg-slate-950 z-[60] overflow-y-auto pt-10 px-4">
                      <Button variant="ghost" onClick={() => setActiveStandaloneMatchId(null)} className="mb-4 text-white">← Close Scorer</Button>
                      <MatchScorer matchId={activeStandaloneMatchId} tournamentId="standalone" />
                    </div>
                  )}
                </div>
              )}

              {user.role === "manager" && (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-xl font-black italic text-indigo-400">Team Control</h3>
                    {teams.find(t => t.managerUid === user.uid) ? (
                      <Card className="bg-slate-900 border-white/5 p-6 rounded-3xl">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 group">
                              <h4 className="text-2xl font-black italic text-white">{teams.find(t => t.managerUid === user.uid)?.name}</h4>
                              <Dialog>
                                <DialogTrigger render={
                                  <Button 
                                    onClick={() => setTeamNameInput(teams.find(t => t.managerUid === user.uid)?.name || "")}
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/5 transition-all"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                                  </Button>
                                }>
                                </DialogTrigger>
                                <DialogContent className="bg-slate-950 border-white/10 text-white rounded-[2rem]">
                                  <DialogHeader>
                                    <DialogTitle className="text-xl font-black italic tracking-tighter uppercase">Rename Team</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <Input 
                                      id="edit-team-name"
                                      value={teamNameInput}
                                      onChange={(e) => setTeamNameInput(e.target.value)}
                                      className="bg-slate-900 border-white/10 h-12 rounded-xl"
                                    />
                                    <Button 
                                      onClick={() => {
                                        const team = teams.find(t => t.managerUid === user.uid);
                                        if (team) {
                                          updateTeamName(team.id, teamNameInput);
                                        }
                                      }}
                                      className="w-full h-12 bg-indigo-600 text-white font-black italic rounded-xl"
                                    >
                                      Save New Name
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{teams.find(t => t.managerUid === user.uid)?.teamId}</span>
                          </div>
                          <Badge className="bg-indigo-600 text-white italic">{(teams.find(t => t.managerUid === user.uid) as any)?.type}</Badge>
                        </div>
                        <div className="mt-6 flex flex-wrap gap-4">
                          <button 
                            onClick={() => setIsManagingPlayers(true)}
                            className="flex-1 min-w-[140px] bg-white/5 p-4 rounded-2xl border border-white/5 text-left transition-all hover:bg-white/10 active:scale-95"
                          >
                            <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Squad Pool</span>
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-black text-white italic">{teams.find(t => t.managerUid === user.uid)?.playerIds?.length || 0}</span>
                              <ChevronRight className="w-5 h-5 text-indigo-400 opacity-50" />
                            </div>
                          </button>
                          <button 
                            onClick={() => setIsManagingSquad(true)}
                            className="flex-1 min-w-[140px] bg-indigo-600/10 p-4 rounded-2xl border border-indigo-600/20 text-left transition-all hover:bg-indigo-600/20 active:scale-95"
                          >
                            <span className="text-[10px] font-black text-indigo-400 uppercase block mb-1">Playing 11</span>
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-black text-white italic">{teams.find(t => t.managerUid === user.uid)?.playing11Ids?.length || 0}/11</span>
                              <ChevronRight className="w-5 h-5 text-white/50" />
                            </div>
                          </button>
                        </div>

                        {isManagingSquad && (
                          <div className="fixed inset-0 bg-slate-950 z-[70] overflow-y-auto p-4 sm:p-10">
                            <div className="max-w-4xl mx-auto space-y-8">
                              <div className="flex items-center justify-between">
                                <Button variant="ghost" onClick={() => setIsManagingSquad(false)} className="text-white">← BACK TO HQ</Button>
                                <div className="text-right">
                                  <h3 className="text-2xl font-black italic tracking-tighter text-indigo-400">LINEUP CONFIGURATOR</h3>
                                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{teams.find(t => t.managerUid === user.uid)?.name} • Match Ready</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-4">
                                {players.filter(p => teams.find(t => t.managerUid === user.uid)?.playerIds?.includes(p.uid)).map(p => {
                                  const team = teams.find(t => t.managerUid === user.uid);
                                  const isInLineup = team?.playing11Ids?.includes(p.uid);
                                  const isCaptain = team?.captainId === p.uid;
                                  const isViceCaptain = team?.viceCaptainId === p.uid;

                                  return (
                                    <Card key={p.uid} className={`bg-slate-900 border-white/5 p-4 flex flex-col sm:flex-row items-center gap-6 transition-all ${isInLineup ? 'border-indigo-500/50 bg-indigo-500/5' : 'opacity-60'}`}>
                                      <div className="flex items-center gap-4 flex-1">
                                         <div className="relative">
                                           <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center font-black text-indigo-400 italic text-2xl overflow-hidden">
                                             {p.photoURL ? <img src={p.photoURL} className="w-full h-full object-cover" /> : p.displayName[0]}
                                           </div>
                                           {isCaptain && (
                                             <div className="absolute -top-2 -right-2 bg-yellow-500 text-black w-7 h-7 rounded-full flex items-center justify-center shadow-xl border-4 border-slate-900">
                                               <Crown className="w-3.5 h-3.5" />
                                             </div>
                                           )}
                                           {isViceCaptain && (
                                             <div className="absolute -top-2 -right-2 bg-slate-400 text-black w-7 h-7 rounded-full flex items-center justify-center shadow-xl border-4 border-slate-900">
                                               <Medal className="w-3.5 h-3.5" />
                                             </div>
                                           )}
                                         </div>
                                         <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-lg font-black text-white italic uppercase">{p.displayName}</span>
                                              {isInLineup && <Badge className="bg-indigo-600 text-[8px] font-black italic px-2">XI</Badge>}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {["batter", "bowler", "all-rounder"].map(role => {
                                                const hasRole = p.roles?.includes(role) || p.specialization === role;
                                                return (
                                                  <button
                                                    key={role}
                                                    onClick={() => updatePlayerRoles(p.uid, role)}
                                                    className={`text-[8px] font-black uppercase italic px-2 py-1 rounded border transition-all ${
                                                      hasRole 
                                                        ? 'bg-indigo-600/20 text-indigo-400 border-indigo-600/30' 
                                                        : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/20'
                                                    }`}
                                                  >
                                                    {role}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                         </div>
                                      </div>

                                      <div className="flex items-center gap-3">
                                         <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                                            <Button 
                                              onClick={() => setLeaderRole(team!.id, p.uid, "captain")}
                                              variant="ghost" 
                                              size="sm" 
                                              className={`h-9 px-3 text-[9px] font-black italic gap-2 rounded-lg transition-all ${isCaptain ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'text-slate-400 hover:bg-white/10'}`}
                                            >
                                              <Crown className="w-3.5 h-3.5" /> {isCaptain ? "CAPTAIN" : "C"}
                                            </Button>
                                            <Button 
                                              onClick={() => setLeaderRole(team!.id, p.uid, "viceCaptain")}
                                              variant="ghost" 
                                              size="sm" 
                                              className={`h-9 px-3 text-[9px] font-black italic gap-2 rounded-lg transition-all ${isViceCaptain ? 'bg-slate-400 text-black hover:bg-slate-300' : 'text-slate-400 hover:bg-white/10'}`}
                                            >
                                              <Medal className="w-3.5 h-3.5" /> {isViceCaptain ? "VICE" : "VC"}
                                            </Button>
                                         </div>
                                         <Button 
                                           onClick={() => togglePlaying11(team!.id, p.uid)}
                                           className={`h-11 px-6 text-[10px] font-black italic rounded-xl shadow-xl transition-all active:scale-95 ${
                                             isInLineup 
                                               ? 'bg-red-600 text-white hover:bg-red-500 shadow-red-600/20' 
                                               : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20'
                                           }`}
                                         >
                                           {isInLineup ? 'BENCH' : 'SELECT'}
                                         </Button>
                                      </div>
                                    </Card>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {isManagingPlayers && (
                          <div className="fixed inset-0 bg-slate-950 z-[70] overflow-y-auto p-4 sm:p-10">
                            <div className="max-w-4xl mx-auto space-y-8">
                              <div className="flex items-center justify-between">
                                <Button variant="ghost" onClick={() => setIsManagingPlayers(false)} className="text-white">← BACK TO HQ</Button>
                                <h3 className="text-2xl font-black italic tracking-tighter text-indigo-400">ROSTER MANAGEMENT</h3>
                              </div>

                              <Card className="bg-indigo-900/20 border-white/5 p-6 rounded-[2rem] flex flex-col sm:flex-row items-center gap-4">
                                <div className="p-3 bg-indigo-600 rounded-2xl">
                                  <UserPlus className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1 space-y-1 text-center sm:text-left">
                                  <h4 className="text-white font-black italic uppercase tracking-tight">Quick Player Invite</h4>
                                  <p className="text-[10px] text-indigo-300/60 font-bold uppercase tracking-widest">Enter Player Unique ID to send recruitment invitation</p>
                                </div>
                                <div className="flex w-full sm:w-auto gap-2">
                                  <Input 
                                    placeholder="CRIC-XXXXXX" 
                                    value={invitePlayerId} 
                                    onChange={e => setInvitePlayerId(e.target.value)}
                                    className="bg-slate-900 border-white/10 text-white font-black italic tracking-widest h-12 w-full sm:w-48 placeholder:opacity-30"
                                  />
                                  <Button 
                                    onClick={handleInviteById}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black italic px-8 h-12 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                  >
                                    Invite
                                  </Button>
                                </div>
                              </Card>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {players.filter(p => teams.find(t => t.managerUid === user.uid)?.playerIds?.includes(p.uid)).map(p => (
                                  <Card key={p.uid} className="bg-slate-900 border-white/5 p-5 flex items-center gap-4 group relative">
                                    <div className="w-14 h-14 rounded-xl bg-indigo-600/20 flex items-center justify-center font-black text-indigo-400 italic text-xl">
                                      {p.photoURL ? <img src={p.photoURL} className="w-full h-full object-cover rounded-xl" /> : p.displayName[0]}
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-sm font-black text-white italic uppercase">{p.displayName}</div>
                                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">{p.playerUniqueId}</div>
                                      <Badge variant="outline" className="bg-white/5 border-white/5 text-[8px] font-black uppercase italic text-indigo-400">{p.specialization}</Badge>
                                    </div>
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => removePlayer(p.uid)}
                                        className="w-8 h-8 text-red-500 hover:bg-red-500/10 rounded-full"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </Card>
                                ))}
                                {(!teams.find(t => t.managerUid === user.uid)?.playerIds || teams.find(t => t.managerUid === user.uid)?.playerIds?.length === 0) && (
                                  <div className="col-span-full py-20 text-center space-y-4">
                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                      <Plus className="w-10 h-10 text-slate-700" />
                                    </div>
                                    <p className="text-slate-500 font-medium italic">No players in squad. Search for players to build your team!</p>
                                    <Button onClick={() => { setIsManagingPlayers(false); setActiveTab("search"); setSearchFilter("players"); }} className="bg-indigo-600 text-white font-black italic">Find Players</Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    ) : (
                      <Card className="bg-slate-900/50 border-2 border-dashed border-white/10 p-10 rounded-[2rem] text-center space-y-4">
                        <Users className="w-12 h-12 text-slate-700 mx-auto" />
                        <div className="space-y-1">
                          <h4 className="text-lg font-black text-white italic">Create Your Team</h4>
                          <p className="text-xs text-slate-500 font-medium">You need a team to enter tournaments and manage players.</p>
                        </div>
                        <div className="flex gap-2 max-w-sm mx-auto">
                          <Input placeholder="Team Name" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} className="bg-slate-900 border-white/10" />
                          <Button onClick={createTeam} className="bg-white text-black font-black italic">Create</Button>
                        </div>
                      </Card>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xl font-black italic text-indigo-400">Registered Tournaments</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tournaments.filter(t => t.teamIds?.includes(teams.find(tm => tm.managerUid === user.uid)?.id || "")).map(t => (
                        <TournamentCard key={t.id} tournament={t} onSelect={() => setSelectedTournamentId(t.id)} />
                      ))}
                    </div>
                  </div>

                  {selectedTournamentId && (
                    <div className="fixed inset-0 bg-slate-950 z-[60] overflow-y-auto pt-10 px-4">
                      <Button variant="ghost" onClick={() => setSelectedTournamentId(null)} className="mb-4 text-white">← Close Board</Button>
                      <TournamentDashboard tournamentId={selectedTournamentId} />
                    </div>
                  )}
                </div>
              )}

              {user.role === "player" && (
                <div className="space-y-8">
                  <PlayerIDCard player={user} />
                  
                  <PlayerPerformance userUid={user.uid} matches={matches} teams={teams} />

                  <Card className="bg-slate-900 border-white/5 p-6 rounded-3xl">
                    <CardHeader className="p-0 mb-4"><CardTitle className="text-sm font-black text-indigo-400 uppercase italic">My Team Info</CardTitle></CardHeader>
                    {teams.find(t => t.playerIds?.includes(user.uid)) ? (
                      <div className="flex items-center justify-between">
                         <div>
                            <h4 className="font-black text-white italic">{teams.find(t => t.playerIds?.includes(user.uid))?.name}</h4>
                            <span className="text-[10px] text-slate-500 uppercase font-black">{teams.find(t => t.playerIds?.includes(user.uid))?.teamId}</span>
                         </div>
                         <Shield className="w-8 h-8 text-indigo-500 opacity-20" />
                      </div>
                    ) : (
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                        <p className="text-xs text-slate-500 font-medium italic">You are currently a free agent. Managers can invite you to their teams.</p>
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "tournaments" && (
            <motion.div 
              key="tab-tournaments"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto px-4 space-y-6"
            >
              <h2 className="text-4xl font-black italic tracking-tighter">ALL EVENTS</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {tournaments.map(t => (
                   <TournamentCard 
                    key={t.id} 
                    tournament={t} 
                    onSelect={() => setSelectedTournamentId(t.id)}
                    actionBtn={user.role === "manager" && !t.teamIds?.includes(teams.find(tm => tm.managerUid === user.uid)?.id || "") ? (
                      <Button onClick={(e: any) => { e.stopPropagation(); joinTournament(t.id); }} size="sm" className="bg-indigo-600 text-white font-bold h-7 text-[10px]">ENTER TEAM</Button>
                    ) : null}
                  />
                 ))}
              </div>
              {selectedTournamentId && (
                <div className="fixed inset-0 bg-slate-950 z-[60] overflow-y-auto pt-10 px-4">
                  <Button variant="ghost" onClick={() => setSelectedTournamentId(null)} className="mb-4 text-white">← Close Board</Button>
                  <TournamentDashboard tournamentId={selectedTournamentId} />
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "leaderboard" && (
            <motion.div 
              key="tab-leaderboard"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto px-4"
            >
              <Leaderboard players={players} teams={teams} />
            </motion.div>
          )}

          {activeTab === "search" && (
            <motion.div 
              key="tab-search"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto px-4 space-y-6"
            >
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input 
                    placeholder={`Search ${searchFilter}...`} 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-slate-900 border-white/10 h-14 pl-12 rounded-2xl text-white font-medium shadow-xl"
                  />
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {(["players", "teams", "tournaments", "matches"] as const).map(f => (
                    <Button 
                      key={f}
                      size="sm"
                      variant={searchFilter === f ? "default" : "outline"}
                      onClick={() => setSearchFilter(f)}
                      className={`rounded-full h-8 px-4 text-[10px] font-black uppercase italic tracking-widest ${searchFilter === f ? 'bg-indigo-600' : 'bg-white/5 border-white/5 text-slate-400'}`}
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchFilter === "players" && players.filter(p => 
                    p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    p.playerUniqueId?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(p => {
                    const managerTeam = teams.find(t => t.managerUid === user?.uid);
                    const isAlreadyInAnyTeam = teams.some(t => t.playerIds?.includes(p.uid));
                    const pendingRequest = requests.find(r => r.fromUid === user?.uid && r.toUid === p.uid && r.status === "pending");

                    return (
                      <Card key={p.uid} className="bg-slate-900 border-white/5 p-6 flex flex-col items-center gap-4 group relative hover:border-indigo-500/50 transition-all overflow-hidden rounded-[2rem] shadow-xl">
                        <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 flex items-center justify-center font-black text-indigo-400 italic text-3xl relative mb-2">
                          {p.photoURL ? <img src={p.photoURL} className="w-full h-full object-cover rounded-3xl" /> : p.displayName[0]}
                          {!isAlreadyInAnyTeam && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
                               <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            </div>
                          )}
                        </div>

                        <div className="text-center space-y-1">
                          <h4 className="text-lg font-black text-white italic truncate max-w-[150px]">{p.displayName}</h4>
                          <div className="flex items-center justify-center gap-2">
                             <Badge variant="outline" className="bg-white/5 border-white/5 text-[8px] font-black uppercase text-slate-400">{p.playerUniqueId}</Badge>
                             {!isAlreadyInAnyTeam && <Badge className="bg-indigo-600/10 text-indigo-400 border-indigo-600/20 text-[8px] font-black uppercase italic">Free Agent</Badge>}
                             <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{p.specialization || "Player"}</span>
                          </div>
                        </div>

                        {user?.role === "manager" && managerTeam && !isAlreadyInAnyTeam && (
                          <div className="w-full pt-4 mt-auto border-t border-white/5">
                            <Button 
                              disabled={!!pendingRequest}
                              onClick={() => sendJoinRequest(p.uid, managerTeam.id, "manager_to_player")}
                              className={`w-full h-10 rounded-xl font-black italic uppercase text-[10px] tracking-widest transition-all ${
                                pendingRequest ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                              }`}
                            >
                              {pendingRequest ? "Request Pending" : (
                                <><UserPlus className="w-4 h-4 mr-2" /> Add to Team</>
                              )}
                            </Button>
                          </div>
                        )}

                        {isAlreadyInAnyTeam && (
                          <div className="w-full pt-4 mt-auto">
                            <Badge className="w-full bg-emerald-500/10 text-emerald-500 border-emerald-500/20 h-8 flex items-center justify-center rounded-xl font-bold italic text-[8px] uppercase tracking-widest">
                              Signed Player
                            </Badge>
                          </div>
                        )}
                        
                        {!managerTeam && user?.role === "manager" && (
                          <div className="w-full pt-4 mt-auto">
                            <p className="text-[8px] text-slate-400 font-black uppercase text-center italic">Create a team to recruit</p>
                          </div>
                        )}
                      </Card>
                    );
                  })}

                 {searchFilter === "teams" && teams.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).map(t => (
                   <Card key={t.id} className="bg-slate-900 border-white/5 p-5 flex flex-col gap-4 group relative hover:border-indigo-500/50 transition-all">
                      <div className="flex items-center gap-3">
                         <div className="w-12 h-12 rounded-xl bg-orange-600/20 flex items-center justify-center font-black text-orange-400 text-xl italic border border-orange-600/20">
                            {t.name[0]}
                         </div>
                         <div className="flex-1">
                            <div className="text-sm font-black text-white italic uppercase tracking-tight">{t.name}</div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase">{t.playerIds?.length || 0} PLAYERS</div>
                         </div>
                      </div>
                      {user?.role === "player" && !teams.find(tm => tm.playerIds?.includes(user!.uid)) && (
                        <Button 
                          onClick={() => sendJoinRequest(t.managerUid, t.id, "player_to_team")}
                          className="w-full h-9 bg-white/5 border border-white/10 hover:bg-indigo-600/20 text-white rounded-xl text-[10px] font-black uppercase italic"
                        >
                          Request to Join Team
                        </Button>
                      )}
                      {user?.role === "arranger" && tournaments.filter(tr => tr.arrangerUid === user.uid).length > 0 && (
                        <Dialog>
                          <DialogTrigger render={<Button className="w-full h-9 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase italic" />}>
                            Add to Tournament
                          </DialogTrigger>
                          <DialogContent className="bg-slate-950 border-white/10 text-white rounded-[2rem]">
                            <DialogHeader><DialogTitle className="text-xl font-black italic uppercase tracking-tight">Select Tournament</DialogTitle></DialogHeader>
                            <div className="grid gap-2 mt-4">
                              {tournaments.filter(tr => tr.arrangerUid === user.uid).map(tr => (
                                <Button 
                                  key={tr.id}
                                  onClick={() => joinTournament(tr.id)} // Arranger direct add logic in joinTournament
                                  className="w-full h-12 bg-white/5 border border-white/5 justify-between px-4 hover:bg-white/10 rounded-xl"
                                >
                                  <span className="font-bold italic uppercase">{tr.name}</span>
                                  <Plus className="w-4 h-4" />
                                </Button>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                   </Card>
                 ))}

                 {searchFilter === "tournaments" && tournaments.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).map(t => (
                   <TournamentCard 
                    key={t.id} 
                    tournament={t} 
                    onSelect={() => setSelectedTournamentId(t.id)} 
                    actionBtn={user.role === "manager" && !t.teamIds?.includes(teams.find(tm => tm.managerUid === user.uid)?.id || "") ? (
                      <Button onClick={(e: any) => { e.stopPropagation(); joinTournament(t.id); }} size="sm" className="bg-indigo-600 text-white font-bold h-7 text-[10px] rounded-lg">ENTER TEAM</Button>
                    ) : null}
                   />
                 ))}

                 {searchFilter === "matches" && matches.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())).map(m => (
                   <Card key={m.id} className="bg-slate-900 border-white/5 p-5 flex flex-col gap-4 group hover:border-indigo-500/50 transition-all overflow-hidden relative">
                      <div className="absolute top-2 right-2">
                        <Badge className={`${m.status === 'live' ? 'bg-red-600 animate-pulse' : 'bg-slate-800'} text-white border-none font-black italic uppercase text-[8px]`}>
                          {m.status}
                        </Badge>
                      </div>
                      <div className="text-[10px] font-black text-slate-500 uppercase italic mb-1">{m.name}</div>
                      <div className="flex items-center justify-between gap-4">
                         <div className="flex-1 text-center space-y-2">
                            <div className="text-xs font-black text-white italic">{teams.find(t => t.id === m.team1Id)?.name || 'Team 1'}</div>
                            <div className="text-xl font-black text-indigo-400 italic">0/0</div>
                         </div>
                         <div className="text-slate-500 font-black italic text-sm">VS</div>
                         <div className="flex-1 text-center space-y-2">
                            <div className="text-xs font-black text-white italic">{teams.find(t => t.id === m.team2Id)?.name || 'Team 2'}</div>
                            <div className="text-xl font-black text-indigo-400 italic">0/0</div>
                         </div>
                      </div>
                   </Card>
                 ))}
              </div>
            </motion.div>
          )}

          {activeTab === "profile" && user && (
            <motion.div 
              key="tab-profile"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto px-4 space-y-8 pb-32"
            >
               {(() => {
                 if (user.role === "manager") {
                   const managedTeams = teams.filter(t => t.managerUid === user.uid);
                   const teamIds = managedTeams.map(t => t.id);
                   const teamMatches = matches.filter(m => teamIds.includes(m.team1Id) || teamIds.includes(m.team2Id));
                   const stats = {
                     teamsManaged: managedTeams.length,
                     totalWins: teamMatches.filter(m => teamIds.includes(m.winnerId || "")).length,
                     totalMatches: teamMatches.filter(m => m.status === "completed").length
                   };
                   return <PlayerIDCard player={user} managerStats={stats} />;
                 } else if (user.role === "arranger") {
                   const organizedTournaments = tournaments.filter(t => t.arrangerUid === user.uid);
                   const organizedMatches = matches.filter(m => m.arrangerUid === user.uid);
                   const stats = {
                     teamsManaged: organizedTournaments.length, // Using this slot for Tournaments
                     totalWins: organizedMatches.filter(m => m.status === "completed").length,
                     totalMatches: organizedMatches.length
                   };
                   return <PlayerIDCard player={user} managerStats={stats} />;
                 } else {
                   return <PlayerIDCard player={user} />;
                 }
               })()}
               
               {user.role === "manager" && teams.filter(t => t.managerUid === user.uid).map(team => (
                 <TeamPerformance 
                  key={team.id}
                  team={team} 
                  matches={matches} 
                  tournaments={tournaments}
                  allPlayers={players}
                 />
               ))}

               <div className="space-y-4">
                 {user.role === "manager" && teams.find(t => t.managerUid === user.uid) && (
                   <Card className="bg-slate-900 border-indigo-500/10 p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-bl-full -z-10" />
                      <h4 className="text-sm font-black text-white italic uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-500" /> Team Management
                      </h4>
                      <div className="space-y-6">
                         <div className="space-y-2">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Squad ({teams.find(t => t.managerUid === user.uid)?.playerIds?.length || 0})</p>
                           <div className="grid grid-cols-5 gap-2">
                              {teams.find(t => t.managerUid === user.uid)?.playerIds?.map(pid => {
                                const p = players.find(player => player.uid === pid);
                                return (
                                  <div key={pid} className="aspect-square rounded-xl bg-white/5 border border-white/5 flex items-center justify-center font-black text-indigo-400 italic text-sm group relative">
                                     {p?.photoURL ? <img src={p.photoURL} className="w-full h-full object-cover rounded-xl" /> : p?.displayName?.[0]}
                                     <div className="absolute inset-0 bg-slate-950/80 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                       <p className="text-[8px] text-white font-black uppercase truncate px-1 text-center">{p?.displayName}</p>
                                      </div>
                                  </div>
                                );
                              })}
                           </div>
                         </div>

                         {requests.filter(r => r.fromUid === user.uid && r.type === "manager_to_player" && r.status === "pending").length > 0 && (
                           <div className="space-y-2">
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pending Recruitments</p>
                             <div className="space-y-2">
                                {requests.filter(r => r.fromUid === user.uid && r.type === "manager_to_player" && r.status === "pending").map(req => {
                                  const targetPlayer = players.find(p => p.uid === req.toUid);
                                  return (
                                    <div key={req.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                                       <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center font-black text-indigo-400 italic text-xs">
                                            {targetPlayer?.photoURL ? <img src={targetPlayer.photoURL} className="w-full h-full object-cover rounded-lg" /> : targetPlayer?.displayName?.[0]}
                                          </div>
                                          <div className="text-xs font-black text-white italic uppercase">{targetPlayer?.displayName}</div>
                                       </div>
                                       <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[8px] font-black uppercase tracking-widest">Invited</Badge>
                                    </div>
                                  );
                                })}
                             </div>
                           </div>
                         )}
                      </div>
                   </Card>
                 )}
                 <Card className="bg-slate-900 border-white/5 p-6 rounded-3xl">
                   <CardHeader className="p-0 mb-4 font-black uppercase text-xs text-slate-500 tracking-widest italic">Account Details</CardHeader>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Full Name</span>
                        <span className="text-sm font-bold text-white uppercase italic">{user.displayName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Role</span>
                        <span className="text-sm font-bold text-white uppercase italic">{user.role}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Member Since</span>
                        <span className="text-sm font-bold text-white italic">April 2024</span>
                      </div>
                   </div>
                 </Card>
                 <Button onClick={() => { sessionStorage.removeItem("cric_active_uid"); window.location.reload(); }} className="w-full bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-500/20 h-14 rounded-2xl font-black italic">SIGN OUT</Button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

const NavButton = ({ active, icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`
      flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all gap-1
      ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}
    `}
  >
    {cloneElement(icon, { className: "w-5 h-5" })}
    <span className="text-[9px] font-black uppercase italic tracking-tighter">{label}</span>
  </button>
);

const TournamentCard = ({ tournament, onSelect, actionBtn, onDelete }: any) => (
  <Card onClick={onSelect} className="bg-slate-900 border-white/5 group hover:border-indigo-500/50 transition-all cursor-pointer overflow-hidden p-6 relative">
    <div className="flex justify-between items-start">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-indigo-600/10 text-indigo-400 border-none font-black italic uppercase text-[9px]">{tournament.status}</Badge>
          {onDelete && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
              className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all shadow-lg"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <h4 className="text-xl font-black italic text-white leading-tight uppercase tracking-tighter">{tournament.name}</h4>
      </div>
      {actionBtn ? actionBtn : <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-indigo-400 transition-colors" />}
    </div>
    <div className="mt-4 flex gap-3">
      <div className="flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase italic">
        <Users className="w-3 h-3" /> {tournament.teamIds?.length || 0} Teams
      </div>
      <div className="flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase italic">
        <Calendar className="w-3 h-3" /> {tournament.overs} Overs
      </div>
    </div>
  </Card>
);
