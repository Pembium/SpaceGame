// Room Library (extracted)
window.ROOM_LIBRARY = [
  // Engines
  { id:"eng_standard", type:"Engine", letter:"E", name:"Standard Thruster Engine", hpMax:5, cost:30, maneuverability:0,
    traits:["Engine Speed +6"], disabled:["Ship cannot Maneuver","Defense Value −2"],
    stabilized:["Ship may Maneuver at +2 difficulty"], notes:"Baseline engine for small ships and freighters." },
  { id:"eng_high_output", type:"Engine", letter:"E", name:"High-Output Drive", hpMax:6, cost:45, maneuverability:3,
    traits:["Engine Speed +9","+1 to Initiative rolls"], disabled:["Defense Value −3","Initiative rolls automatically fail"],
    stabilized:["Initiative rolls at +2 difficulty"], notes:"Fast interceptors, smugglers, elite craft." },
  { id:"eng_maneuver_thrusters", type:"Engine", letter:"E", name:"Maneuvering Thrusters", hpMax:4, cost:35, maneuverability:6,
    traits:["+2 Defense Value against attacks","Maneuver actions gain +1 effect"], disabled:["Defense Value −2"],
    stabilized:["Defense penalty reduced to −1"], notes:"Dogfighting and evasive ships." },

  // Shields
  { id:"sh_standard", type:"Shield", letter:"S", name:"Standard Shield Generator", hpMax:5, cost:28, defense:2,
    traits:["Shield Value 2"], disabled:["Shield Value reduced to 0","Shields do not regenerate"],
    stabilized:["Shield Value remains 0","Regeneration resumes next turn"], notes:"Baseline defense." },
  { id:"sh_reinforced", type:"Shield", letter:"S", name:"Reinforced Shield Generator", hpMax:6, cost:40, defense:4,
    traits:["Shield Value 4"], disabled:["Shield Value reduced to 1","No regeneration"],
    stabilized:["Shield Value fixed at 1","Regeneration resumes"], notes:"Military or high-end ships." },
  { id:"sh_aux_emitter", type:"Shield", letter:"S", name:"Auxiliary Shield Emitter", hpMax:4, cost:32, defense:1,
    traits:["+1 Shield Value","May protect a specific section (table rule)"], disabled:["Bonus shield lost"],
    stabilized:["Bonus shield does not return until repaired after combat"], notes:"Layered defenses and redundancy." },

  // Cockpit / Command
  { id:"cp_standard", type:"Cockpit", letter:"C", name:"Standard Cockpit", hpMax:4, cost:25,
    traits:["No bonuses"], disabled:["Pilot actions +2 difficulty","Initiative rolls fail"],
    stabilized:["Pilot actions +1 difficulty"], notes:"Civilian and basic ships." },
  { id:"cp_armored", type:"Cockpit", letter:"C", name:"Armored Cockpit", hpMax:5, cost:35,
    traits:["Ignores first 1 damage to this section (once per combat)"], disabled:["Pilot stunned; no Maneuver actions next turn"],
    stabilized:["Maneuver allowed at +2 difficulty"], notes:"Combat craft." },
  { id:"cp_bridge", type:"Cockpit", letter:"B", name:"Command Bridge", hpMax:6, cost:50,
    traits:["Once per ship turn: one crew member gains +1 to an action"],
    disabled:["Crew coordination lost","One fewer action available next ship turn"],
    stabilized:["Action penalty removed"], notes:"Large ships and capital vessels." },

  // Life Support
  { id:"ls_standard", type:"Life Support", letter:"L", name:"Standard Life Support", hpMax:5, cost:22,
    traits:["Supports full crew indefinitely"], disabled:["Oxygen depletion: after 3 turns, crew takes 1 damage per turn"],
    stabilized:["Countdown stops (still unusable)"], notes:"Baseline." },
  { id:"ls_hardened", type:"Life Support", letter:"L", name:"Hardened Life Support", hpMax:6, cost:35,
    traits:["Delays oxygen loss by +2 turns (starts after 5 turns)"], disabled:["Crew damage begins after 5 turns"],
    stabilized:["Countdown stops (still unusable)"], notes:"Military vessels." },
  { id:"ls_emergency", type:"Life Support", letter:"L", name:"Emergency Life Support", hpMax:3, cost:15,
    traits:["Activates automatically if primary fails (table rule)"], disabled:["No atmosphere control"],
    stabilized:["Provides 1 extra turn of survival"], notes:"Failsafe system." },

  // Engineering
  { id:"en_engineering", type:"Engineering", letter:"N", name:"Engineering Block", hpMax:5, cost:28,
    traits:["+1 to Repair and Tune actions"], disabled:["Repair and Tune at +2 difficulty"],
    stabilized:["Difficulty reduced to +1"], notes:"Core support system." },
  { id:"en_advanced", type:"Engineering", letter:"N", name:"Advanced Engineering Bay", hpMax:6, cost:42,
    traits:["One extra Tune per ship turn","Ignore first Tune failure each combat (table rule)"], disabled:["No Tune actions allowed"],
    stabilized:["One Tune allowed per ship turn"], notes:"High-end support bay." },

  // Sensors
  { id:"sn_basic", type:"Sensors", letter:"R", name:"Basic Sensor Array", hpMax:4, cost:20,
    traits:["Enables Scan actions"], disabled:["Scan unavailable"],
    stabilized:["Scan at +2 difficulty"], notes:"Baseline sensors." },
  { id:"sn_advanced", type:"Sensors", letter:"R", name:"Advanced Sensor Suite", hpMax:5, cost:38,
    traits:["Scan grants +1 additional effect (table rule)"], disabled:["Targeted attacks unavailable"],
    stabilized:["Scan yields only one effect"], notes:"Precision targeting and intel." },

  // Weapons
  { id:"wp_laser", type:"Weapon", letter:"W", name:"Laser Cannon", hpMax:4, cost:30, damage:3, class:"Science",
    traits:["+1 to hit rolls"], disabled:["Weapon cannot fire"],
    stabilized:["Weapon remains offline until repaired after combat"], notes:"Precision energy weapon." },
  { id:"wp_gatling", type:"Weapon", letter:"W", name:"Gatling Gun", hpMax:5, cost:28, damage:2, class:"Kinetic",
    traits:["Can attack twice at -1 effect each"], disabled:["Weapon jammed","Cannot fire"],
    stabilized:["Single shot only"], notes:"High rate of fire ballistic weapon." },
  { id:"wp_plasma", type:"Weapon", letter:"W", name:"Plasma Projector", hpMax:4, cost:42, damage:4, class:"Science",
    traits:["Ignore 1 point of shield"], disabled:["Weapon overheated","Cannot fire this combat"],
    stabilized:["Reduced to half damage"], notes:"Devastating short-range energy weapon." },
  { id:"wp_missile", type:"Weapon", letter:"W", name:"Missile Launcher", hpMax:5, cost:35, damage:5, class:"Kinetic",
    traits:["+2 damage on hit","Limited ammo (table rule)"], disabled:["No missiles remaining"],
    stabilized:["Half damage, no bonus"], notes:"Heavy ordnance with tracking capability." },

  // Power
  { id:"pw_core", type:"Power", letter:"P", name:"Power Core", hpMax:6, cost:55, battery:100,
    traits:["Enables Tune actions and advanced modules (table rule)"],
    disabled:["All Tune actions disabled","Shields do not regenerate (optional rule)"],
    stabilized:["Tune allowed at +2 difficulty"], notes:"Central energy system." },
  { id:"pw_aux", type:"Power", letter:"P", name:"Auxiliary Power Unit", hpMax:4, cost:26, battery:50,
    traits:["Provides emergency power when core is down (table rule)"],
    disabled:["No emergency power"], stabilized:["Emergency power lasts 1 ship turn"],
    notes:"Redundancy for critical ships." },
];
// Expose as global identifier for non-module scripts
var ROOM_LIBRARY = window.ROOM_LIBRARY;
