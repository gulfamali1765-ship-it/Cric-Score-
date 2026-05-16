import { db, doc, updateDoc, increment, getDoc, deleteDoc } from "../firebase";
import { Match, UserProfile, Team } from "../types";

export const finalizeMatchStats = async (match: Match, tournamentId: string, winnerId: string) => {
  // 1. Update Career Stats
  const allInningsStats = [
    match.innings[1]?.playerStats || {},
    match.innings[2]?.playerStats || {}
  ];

  const mergedStats: Record<string, any> = {};
  allInningsStats.forEach(inn => {
    Object.entries(inn).forEach(([uid, stats]: [string, any]) => {
      if (!mergedStats[uid]) mergedStats[uid] = {
        runs: 0, balls: 0, wickets: 0, fours: 0, sixes: 0, bowlingRuns: 0, bowlingBalls: 0
      };
      mergedStats[uid].runs += (stats.runs || 0);
      mergedStats[uid].balls += (stats.balls || 0);
      mergedStats[uid].wickets += (stats.wickets || 0);
      mergedStats[uid].fours += (stats.fours || 0);
      mergedStats[uid].sixes += (stats.sixes || 0);
      mergedStats[uid].bowlingRuns += (stats.bowlingRuns || 0);
      mergedStats[uid].bowlingBalls += (stats.bowlingBalls || 0);
    });
  });

  for (const uid in mergedStats) {
    const stats = mergedStats[uid];
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      "stats.matches": increment(1),
      "stats.runs": increment(stats.runs),
      "stats.balls": increment(stats.balls),
      "stats.wickets": increment(stats.wickets),
      "stats.fours": increment(stats.fours),
      "stats.sixes": increment(stats.sixes),
      "stats.fifties": increment(stats.runs >= 50 && stats.runs < 100 ? 1 : 0),
      "stats.centuries": increment(stats.runs >= 100 ? 1 : 0),
      "stats.bowlingRuns": increment(stats.bowlingRuns),
      "stats.bowlingBalls": increment(stats.bowlingBalls),
    });
  }

  // 1.5 Update Team Career Stats
  const team1Ref = doc(db, "teams", match.team1Id);
  const team2Ref = doc(db, "teams", match.team2Id);

  const isT1Winner = winnerId === match.team1Id;
  const isT2Winner = winnerId === match.team2Id;
  const isTie = winnerId === "tie";

  // Get runs for aggregate team stats
  const t1Runs = match.innings[1].battingTeamId === match.team1Id ? match.innings[1].runs : match.innings[2].runs;
  const t2Runs = match.innings[1].battingTeamId === match.team2Id ? match.innings[1].runs : match.innings[2].runs;
  const t1Wickets = match.innings[1].battingTeamId === match.team1Id ? match.innings[1].wickets : match.innings[2].wickets;
  const t2Wickets = match.innings[1].battingTeamId === match.team2Id ? match.innings[1].wickets : match.innings[2].wickets;

  await updateDoc(team1Ref, {
    "stats.matches": increment(1),
    "stats.won": increment(isT1Winner ? 1 : 0),
    "stats.lost": increment(isT2Winner ? 1 : 0),
    "stats.tied": increment(isTie ? 1 : 0),
    "stats.totalRuns": increment(t1Runs),
    "stats.totalWickets": increment(t1Wickets)
  });

  await updateDoc(team2Ref, {
    "stats.matches": increment(1),
    "stats.won": increment(isT2Winner ? 1 : 0),
    "stats.lost": increment(isT1Winner ? 1 : 0),
    "stats.tied": increment(isTie ? 1 : 0),
    "stats.totalRuns": increment(t2Runs),
    "stats.totalWickets": increment(t2Wickets)
  });

  // 2. Update Point Table
  if (tournamentId && tournamentId !== "standalone" && match.stageId && match.stageId !== "standalone") {
    const tableRef = doc(db, "tournaments", tournamentId, "pointTables", match.stageId);
    const tableSnap = await getDoc(tableRef);
    if (tableSnap.exists()) {
      const table = tableSnap.data() as any;
      const entries = table.entries.map((entry: any) => {
        const isTeam1 = entry.teamId === match.team1Id;
        const isTeam2 = entry.teamId === match.team2Id;
        
        if (!isTeam1 && !isTeam2) return entry;

        const isWinner = entry.teamId === winnerId;
        const isLoser = winnerId !== "tie" && !isWinner && (isTeam1 || isTeam2);
        const isTie = winnerId === "tie";

        return {
          ...entry,
          played: entry.played + 1,
          won: entry.won + (isWinner ? 1 : 0),
          lost: entry.lost + (isLoser ? 1 : 0),
          tied: entry.tied + (isTie ? 1 : 0),
          points: entry.points + (isWinner ? 2 : (isTie ? 1 : 0))
        };
      });

      await updateDoc(tableRef, { entries });
    }
  }
};

export const recalculateAllStats = async (
  allMatches: Match[], 
  players: UserProfile[], 
  teams: Team[],
  onProgress?: (percent: number) => void
) => {
  const playerStatsMap: Record<string, any> = {};
  const teamStatsMap: Record<string, any> = {};

  // Initialize stats maps
  players.forEach(p => {
    playerStatsMap[p.uid] = { matches: 0, runs: 0, balls: 0, wickets: 0, fours: 0, sixes: 0, fifties: 0, centuries: 0, bowlingRuns: 0, bowlingBalls: 0 };
  });
  teams.forEach(t => {
    teamStatsMap[t.id] = { matches: 0, won: 0, lost: 0, tied: 0, totalRuns: 0, totalWickets: 0 };
  });

  const completedMatches = allMatches.filter(m => m.status === "completed");

  completedMatches.forEach(match => {
    // Player Stats
    const mStats: Record<string, any> = {};
    [match.innings[1], match.innings[2]].forEach(inn => {
      if (!inn) return;
      Object.entries(inn.playerStats || {}).forEach(([uid, stats]: [string, any]) => {
        if (!playerStatsMap[uid]) return; // Skip if player not in list
        if (!mStats[uid]) mStats[uid] = { runs: 0, balls: 0, wickets: 0, fours: 0, sixes: 0, bowlingRuns: 0, bowlingBalls: 0 };
        
        mStats[uid].runs += (stats.runs || 0);
        mStats[uid].balls += (stats.balls || 0);
        mStats[uid].wickets += (stats.wickets || 0);
        mStats[uid].fours += (stats.fours || 0);
        mStats[uid].sixes += (stats.sixes || 0);
        mStats[uid].bowlingRuns += (stats.bowlingRuns || 0);
        mStats[uid].bowlingBalls += (stats.bowlingBalls || 0);
      });
    });

    // Update player totals
    Object.keys(mStats).forEach(uid => {
      const s = mStats[uid];
      playerStatsMap[uid].matches += 1;
      playerStatsMap[uid].runs += s.runs;
      playerStatsMap[uid].balls += s.balls;
      playerStatsMap[uid].wickets += s.wickets;
      playerStatsMap[uid].fours += s.fours;
      playerStatsMap[uid].sixes += s.sixes;
      playerStatsMap[uid].fifties += (s.runs >= 50 && s.runs < 100 ? 1 : 0);
      playerStatsMap[uid].centuries += (s.runs >= 100 ? 1 : 0);
      playerStatsMap[uid].bowlingRuns += s.bowlingRuns;
      playerStatsMap[uid].bowlingBalls += s.bowlingBalls;
    });

    // Team Stats
    if (teamStatsMap[match.team1Id] && teamStatsMap[match.team2Id]) {
      const isT1Winner = match.winnerId === match.team1Id;
      const isT2Winner = match.winnerId === match.team2Id;
      const isTie = match.winnerId === "tie";

      const inn1 = match.innings[1];
      const inn2 = match.innings[2];

      const t1Runs = (inn1?.battingTeamId === match.team1Id ? inn1?.runs : inn2?.runs) || 0;
      const t2Runs = (inn1?.battingTeamId === match.team2Id ? inn1?.runs : inn2?.runs) || 0;
      const t1Wickets = (inn1?.battingTeamId === match.team1Id ? inn1?.wickets : inn2?.wickets) || 0;
      const t2Wickets = (inn1?.battingTeamId === match.team2Id ? inn1?.wickets : inn2?.wickets) || 0; 

      teamStatsMap[match.team1Id].matches += 1;
      teamStatsMap[match.team1Id].won += (isT1Winner ? 1 : 0);
      teamStatsMap[match.team1Id].lost += (isT2Winner ? 1 : 0);
      teamStatsMap[match.team1Id].tied += (isTie ? 1 : 0);
      teamStatsMap[match.team1Id].totalRuns += t1Runs;
      teamStatsMap[match.team1Id].totalWickets += t1Wickets;

      teamStatsMap[match.team2Id].matches += 1;
      teamStatsMap[match.team2Id].won += (isT2Winner ? 1 : 0);
      teamStatsMap[match.team2Id].lost += (isT1Winner ? 1 : 0);
      teamStatsMap[match.team2Id].tied += (isTie ? 1 : 0);
      teamStatsMap[match.team2Id].totalRuns += t2Runs;
      teamStatsMap[match.team2Id].totalWickets += t2Wickets;
    }
  });

  // Batch updates with progress tracking
  const updatePromises = [];
  const playersCount = Object.keys(playerStatsMap).length;
  const teamsCount = Object.keys(teamStatsMap).length;
  const total = playersCount + teamsCount;
  let current = 0;

  const trackProgress = async (promise: Promise<any>) => {
    await promise;
    current++;
    onProgress?.(Math.round((current / total) * 100));
  };

  for (const uid in playerStatsMap) {
    updatePromises.push(trackProgress(updateDoc(doc(db, "users", uid), { stats: playerStatsMap[uid] })));
  }
  for (const tid in teamStatsMap) {
    updatePromises.push(trackProgress(updateDoc(doc(db, "teams", tid), { stats: teamStatsMap[tid] })));
  }
  
  await Promise.all(updatePromises);
};

export const purgeLegacyPlayers = async (players: UserProfile[]) => {
  const legacySearchTerms = ["Virat", "Babar", "Buttler", "Shaheen", "Rashid"];
  const toDelete = players.filter(p => 
    legacySearchTerms.some(term => p.displayName.toLowerCase().includes(term.toLowerCase()))
  );
  
  const deletePromises = toDelete.map(p => {
    return deleteDoc(doc(db, "users", p.uid));
  });
  
  await Promise.all(deletePromises);
  return toDelete.length;
};
