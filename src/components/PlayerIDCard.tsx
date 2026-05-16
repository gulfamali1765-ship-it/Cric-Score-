import React from "react";
import { UserProfile } from "../types";
import { Trophy, Shield, Circle, Medal, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface PlayerIDCardProps {
  player: UserProfile;
  managerStats?: {
    teamsManaged: number;
    totalWins: number;
    totalMatches: number;
  };
}

export const PlayerIDCard: React.FC<PlayerIDCardProps> = ({ player, managerStats }) => {
  const isManager = player.role === "manager";
  const isArranger = player.role === "arranger";
  const isPlayer = player.role === "player";
  
  const isBatter = player.specialization === "batter" || !player.specialization;
  const isBowler = player.specialization === "bowler";

  // Stats calculation with fallbacks
  const stats = player.stats || {
    matches: 0,
    runs: 0,
    balls: 0,
    wickets: 0,
    fours: 0,
    sixes: 0,
    fifties: 0,
    centuries: 0
  };

  const strikeRate = stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : "0.0";
  const winRate = managerStats && managerStats.totalMatches > 0 
    ? ((managerStats.totalWins / managerStats.totalMatches) * 100).toFixed(1) 
    : "0.0";

  // Robust name splitting
  const nameParts = player.displayName.trim().split(/\s+/);
  const firstName = nameParts[0] || "User";
  const lastName = nameParts.slice(1).join(" ");

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full max-w-lg aspect-[1.15/1] sm:aspect-[1.6/1] bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white/10 group mx-auto"
      id="player-id-card"
    >
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-0 right-0 w-full h-full bg-gradient-to-br ${isManager ? 'from-indigo-900 via-slate-950 to-black' : 'from-indigo-900 via-slate-950 to-black'}`} />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 8, repeat: Infinity }}
          className={`absolute -top-24 -right-24 w-80 h-80 ${isManager ? 'bg-indigo-500' : 'bg-emerald-500'} rounded-full blur-[90px]`} 
        />
        <motion.div 
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, delay: 1 }}
          className={`absolute -bottom-24 -left-24 w-80 h-80 ${isManager ? 'bg-purple-500' : 'bg-blue-500'} rounded-full blur-[90px]`} 
        />
        
        {/* Technical Grid Overlay */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        {/* Subtle Light Scan Effect */}
        <motion.div
          animate={{ left: ["-100%", "200%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
          className="absolute top-0 bottom-0 w-1/4 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12"
        />
      </div>

      {/* Main Layout Container */}
      <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-6 z-20">
        
        {/* Top Header: Logo & Status */}
        <div className="flex justify-between items-start w-full">
          <div className="flex items-center gap-2 sm:gap-3 bg-white/5 backdrop-blur-md px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-white/10 shadow-lg">
            <div className={`${isManager ? 'bg-indigo-500/20' : 'bg-emerald-500/20'} p-0.5 sm:p-1 rounded-lg`}>
              {isManager ? <Shield className="w-4 h-4 sm:w-5 h-5 text-indigo-400 fill-indigo-400/10" /> : <Trophy className="w-4 h-4 sm:w-5 h-5 text-emerald-400 fill-emerald-400/10" />}
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-black italic tracking-tighter text-white leading-none">CricScore</span>
              <span className={`text-[6px] sm:text-[7px] font-bold uppercase tracking-widest ${isManager ? 'text-indigo-400/80' : 'text-emerald-400/80'}`}>
                {isManager ? "Manager Portfolio" : isArranger ? "Organizer Record" : "Premium Player Profile"}
              </span>
            </div>
          </div>
          
          <Badge className={`${isManager ? 'bg-indigo-500/90 hover:bg-indigo-500' : 'bg-emerald-500/90 hover:bg-emerald-500'} text-white border-none px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-1.5 sm:gap-2`}>
            {isManager ? <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />}
            {player.role.toUpperCase()}
          </Badge>
        </div>

        {/* Middle Body: Photo & Name Block */}
        <div className="flex items-center gap-3 sm:gap-8 flex-1 py-1 sm:py-0">
          {/* Avatar System */}
          <div className="relative shrink-0">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className={`w-20 h-20 sm:w-32 sm:h-32 rounded-full border-4 ${isManager ? 'border-indigo-500/40' : 'border-emerald-500/40'} p-1 bg-slate-800/60 backdrop-blur-md overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.15)]`}
            >
              {player.photoURL ? (
                <img 
                  src={player.photoURL} 
                  alt={player.displayName} 
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
                  <span className="text-3xl sm:text-4xl font-black text-white/10 uppercase">{player.displayName[0]}</span>
                </div>
              )}
            </motion.div>
            
            {/* Dynamic Icon */}
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className={`absolute -bottom-0.5 -right-0.5 w-8 h-8 sm:w-12 sm:h-12 bg-slate-900 rounded-full border ${isManager ? 'border-indigo-500' : 'border-emerald-500'} flex items-center justify-center shadow-2xl z-30 overflow-hidden`}
            >
              {isManager ? (
                <Medal className="w-4 h-4 sm:w-6 sm:h-6 text-indigo-400" />
              ) : isBatter ? (
                <div className="relative rotate-[-15deg] translate-y-0.5 flex flex-col items-center">
                  <div className="w-1 h-5 sm:w-2 sm:h-8 bg-amber-100 rounded-sm border-b shadow-sm" />
                </div>
              ) : (
                <div className="w-5 h-5 sm:w-8 sm:h-8 bg-red-600 rounded-full border border-red-700 flex items-center justify-center relative overflow-hidden shadow-inner">
                  <div className="w-full h-0.5 bg-white/30 absolute top-1/2 -translate-y-1/2 rotate-45" />
                  <div className="w-full h-0.5 bg-white/30 absolute top-1/2 -translate-y-1/2 -rotate-45" />
                </div>
              )}
            </motion.div>
          </div>

          <div className="flex-1 space-y-0.5 sm:space-y-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className={`text-[6px] sm:text-[9px] font-bold uppercase tracking-[0.3em] sm:tracking-[0.4em] ${isManager ? 'text-indigo-400' : 'text-emerald-400'} drop-shadow-sm`}>
                {isManager ? "Management Status" : "Authenticated Record"}
              </span>
              <div className={`h-px ${isManager ? 'bg-indigo-500/10' : 'bg-emerald-500/10'} flex-1`} />
            </div>
            
            <div className="relative">
              <h3 className="text-xl sm:text-4xl font-black text-white tracking-tighter leading-none uppercase italic drop-shadow-2xl">
                {firstName}
                <br />
                <span className={isManager ? 'text-indigo-400' : 'text-emerald-500'}>{lastName}</span>
              </h3>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 pt-0.5">
              <Badge variant="outline" className="text-[7px] sm:text-[10px] text-slate-400 border-white/5 bg-white/5 font-mono px-1.5 py-0 uppercase tracking-tighter">
                ID: {player.playerUniqueId}
              </Badge>
            </div>
          </div>
        </div>

        {/* Bottom Technical Stats Grid */}
        <div className="grid grid-cols-5 gap-1 sm:gap-3 w-full mt-1 sm:mt-4">
          {isManager ? (
            <>
              <StatBox label="Teams" value={managerStats?.teamsManaged || 0} icon={<Users className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-indigo-400" />} highlightColor="border-indigo-500/40 bg-indigo-500/10" valueColor="text-indigo-400" />
              <StatBox label="Matches" value={managerStats?.totalMatches || 0} highlightColor="border-indigo-500/40 bg-indigo-500/10" valueColor="text-indigo-400" />
              <StatBox label="Wins" value={managerStats?.totalWins || 0} highlightColor="border-indigo-500/40 bg-indigo-500/10" valueColor="text-indigo-400" />
              <StatBox label="Win %" value={winRate} highlight highlightColor="border-indigo-500/40 bg-indigo-500/10" valueColor="text-indigo-400" />
              <StatBox label="Exp" value="Pro" highlightColor="border-indigo-500/40 bg-indigo-500/10" valueColor="text-indigo-400" />
            </>
          ) : (
            <>
              <StatBox label="Matches" value={stats.matches} icon={<Star className="w-2 h-2 sm:w-2.5 sm:h-2.5" />} />
              <StatBox label="Score" value={stats.runs} />
              <StatBox label="50s/100s" value={`${stats.fifties || 0}/${stats.centuries || 0}`} />
              <StatBox label="Wkts" value={stats.wickets} />
              <StatBox label="S/Rate" value={strikeRate} highlight />
            </>
          )}
        </div>
      </div>
      
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rotate-45 translate-x-16 -translate-y-16 border-l border-white/10 pointer-events-none" />
    </motion.div>
  );
};

interface StatBoxProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  icon?: React.ReactNode;
  className?: string;
  highlightColor?: string;
  valueColor?: string;
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, highlight, icon, className, highlightColor, valueColor }) => (
  <motion.div 
    whileHover={{ y: -2 }}
    className={`
      bg-white/5 backdrop-blur-2xl rounded-lg sm:rounded-xl border border-white/5 sm:border-white/10 p-1 sm:p-3 
      flex flex-col items-center justify-center shadow-xl transition-all
      ${highlight ? (highlightColor || 'border-emerald-500/40 bg-emerald-500/10') : ''}
      ${className}
    `}
  >
    <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
      {icon && <span className="">{icon}</span>}
      <span className="text-[5px] sm:text-[8px] font-black text-slate-500 uppercase tracking-tight sm:tracking-widest text-center leading-none">{label}</span>
    </div>
    <span className={`text-[9px] sm:text-base font-black ${highlight ? (valueColor || 'text-emerald-400') : (valueColor || 'text-white')} font-mono leading-none`}>
      {value}
    </span>
    {highlight && (
      <div className={`mt-0.5 w-3 sm:w-4 h-0.5 ${valueColor === 'text-indigo-400' ? 'bg-indigo-500' : 'bg-emerald-500'} rounded-full`} />
    )}
  </motion.div>
);
