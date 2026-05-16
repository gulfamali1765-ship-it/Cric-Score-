export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  role: "player" | "manager" | "arranger" | "admin";
  playerUniqueId?: string;
  category?: "Silver" | "Gold" | "Platinum" | "Diamond";
  isBiddingRegistered?: boolean;
  photoURL?: string;
  specialization?: "batter" | "bowler" | "all-rounder";
  roles?: string[];
  recentScores?: number[];
  stats?: {
    matches: number;
    runs: number;
    balls: number;
    wickets: number;
    fours: number;
    sixes: number;
    fifties?: number;
    centuries?: number;
    bowlingRuns?: number;
    bowlingBalls?: number;
  };
};

export type TournamentStage = {
  id: string;
  name: string;
  type: "round-robin" | "knockout" | "playoff" | "double-elimination" | "group-knockout";
  order: number;
  config: {
    matchesPerTeam?: number;
    qualifiersCount?: number; // e.g., Top 4 go to next stage
  };
  status: "pending" | "ongoing" | "completed";
};

export type TeamStats = {
  matches: number;
  won: number;
  lost: number;
  tied: number;
  totalRuns: number;
  totalWickets: number;
};

export type Team = {
  id: string;
  name: string;
  teamId: string;
  managerUid: string;
  playerIds: string[];
  playing11Ids?: string[];
  captainId?: string;
  viceCaptainId?: string;
  type?: "Village" | "City" | "Club";
  tournamentId?: string;
  stats?: TeamStats;
};

export type JoinRequest = {
  id: string;
  fromUid: string;
  fromName: string;
  toUid: string; // manager, player or arranger
  teamId?: string;
  tournamentId?: string;
  status: "pending" | "accepted" | "declined";
  type: "player_to_team" | "manager_to_player" | "team_to_tournament" | "tournament_to_team";
  createdAt: any;
};

export type Tournament = {
  id: string;
  name: string;
  arrangerUid: string;
  description?: string;
  status: "setup" | "ongoing" | "completed";
  maxTeams: number;
  overs: number;
  playersPerTeam: number;
  stages: TournamentStage[];
  currentStageId?: string;
  teamIds: string[];
};

export type PointTableEntry = {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  nrr: number; // Net Run Rate
};

export type PointTable = {
  tournamentId: string;
  stageId: string;
  entries: PointTableEntry[];
};

export type BallEvent = {
  type: "run" | "wicket" | "wide" | "no-ball";
  value: number;
  batsmanUid: string;
  bowlerUid: string;
  isLegal: boolean;
  timestamp: number;
  wicketDetails?: {
    type: "bowled" | "caught" | "lbw" | "run-out" | "stumped" | "others";
    fielderUid?: string;
    outBatsmanUid?: string;
  };
};

export type MatchPlayerStats = {
  uid: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  wickets: number;
  overs: number;
  bowlingRuns: number;
  bowlingBalls: number;
  isOut?: boolean;
};

export type Match = {
  id: string;
  tournamentId: string;
  stageId: string;
  name: string;
  team1Id: string;
  team2Id: string;
  status: "scheduled" | "live" | "completed";
  winnerId?: string;
  overs: number;
  playersPerTeam: number;
  innings: {
    1: InningState;
    2: InningState;
  };
  currentInnings: 1 | 2;
  tossWinnerId?: string;
  tossDecision?: "bat" | "bowl";
  strikerUid?: string;
  nonStrikerUid?: string;
  bowlerUid?: string;
  lastBowlerUid?: string;
  arrangerUid?: string;
};

export type InningState = {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  balls: number;
  history: BallEvent[];
  playerStats: Record<string, MatchPlayerStats>;
};
