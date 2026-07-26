import path from "node:path";
import { DATA_ROOT, writeJson } from "./lol-data-lib.mjs";

const TARGETS_PATH = path.join(DATA_ROOT, "source-targets", "players.v1.targets.json");

const easyIds = new Set([
  "faker",
  "chovy",
  "canyon",
  "showmaker",
  "zeus",
  "caps",
  "brokenblade",
  "hans_sama",
  "jackeylove",
  "meiko",
  "bin",
  "blaber",
  "doran",
  "peyz",
  "kiin",
  "ruler",
  "xun",
  "on",
  "viper",
  "369",
  "tian",
  "rookie",
  "tarzan",
  "razork",
  "upset",
  "yike",
  "elyoya",
  "jojopyun",
  "massu",
  "corejj",
  "impact",
  "uzi",
  "xiaohu",
  "elk",
  "scout",
  "clearlove",
  "kkoma",
  "mata",
  "perkz",
  "doublelift",
  "bjergsen"
]);

function player({
  id,
  nickname,
  gcdRegion,
  pageTitle = nickname,
  gcdName = nickname,
  aliases = []
}) {
  return {
    id,
    nickname,
    pageTitle,
    gcdRegion,
    gcdName,
    aliases,
    difficulties: easyIds.has(id) ? ["normal", "easy"] : ["normal"]
  };
}

const players = [
  player({ id: "faker", nickname: "Faker", gcdRegion: "KR", aliases: ["Hide on bush", "李相赫", "李哥", "大魔王", "大飞老师"] }),
  player({ id: "oner", nickname: "Oner", gcdRegion: "KR" }),
  player({ id: "keria", nickname: "Keria", gcdRegion: "KR" }),
  player({ id: "chovy", nickname: "Chovy", gcdRegion: "KR", aliases: ["超威"] }),
  player({ id: "canyon", nickname: "Canyon", gcdRegion: "KR", aliases: ["三叔"] }),
  player({ id: "showmaker", nickname: "ShowMaker", gcdRegion: "KR", aliases: ["许秀"] }),
  player({ id: "zeus", nickname: "Zeus", gcdRegion: "KR" }),
  player({ id: "zeka", nickname: "Zeka", pageTitle: "Zeka (Kim Geon-woo)", gcdRegion: "KR" }),
  player({ id: "kanavi", nickname: "Kanavi", gcdRegion: "KR", aliases: ["看片哥"] }),
  player({ id: "gumayusi", nickname: "Gumayusi", gcdRegion: "KR", aliases: ["小吕布"] }),
  player({ id: "caps", nickname: "Caps", gcdRegion: "EMEA", aliases: ["帽皇"] }),
  player({ id: "brokenblade", nickname: "BrokenBlade", gcdRegion: "EMEA", aliases: ["BB"] }),
  player({ id: "mikyx", nickname: "Mikyx", gcdRegion: "EMEA" }),
  player({ id: "hans_sama", nickname: "Hans Sama", gcdRegion: "EMEA" }),
  player({ id: "jackeylove", nickname: "JackeyLove", gcdRegion: "CN", aliases: ["JKL", "喻文波", "阿水"] }),
  player({ id: "meiko", nickname: "Meiko", gcdRegion: "CN", aliases: ["田野", "妹扣"] }),
  player({ id: "knight", nickname: "knight", pageTitle: "Knight (Zhuo Ding)", gcdRegion: "CN", gcdName: "knight", aliases: ["左手", "黄金左手"] }),
  player({ id: "bin", nickname: "Bin", pageTitle: "Bin (Chen Ze-Bin)", gcdRegion: "CN", aliases: ["阿Bin", "阿宾"] }),
  player({ id: "blaber", nickname: "Blaber", gcdRegion: "AME" }),
  player({ id: "vulcan", nickname: "Vulcan", pageTitle: "Vulcan (Philippe Laflamme)", gcdRegion: "AME" }),

  player({ id: "doran", nickname: "Doran", pageTitle: "Doran (Choi Hyeon-joon)", gcdRegion: "KR" }),
  player({ id: "peyz", nickname: "Peyz", gcdRegion: "KR" }),
  player({ id: "kiin", nickname: "Kiin", gcdRegion: "KR" }),
  player({ id: "ruler", nickname: "Ruler", gcdRegion: "KR", aliases: ["朴载赫", "尺帝"] }),
  player({ id: "duro", nickname: "Duro", gcdRegion: "KR" }),
  player({ id: "delight", nickname: "Delight", gcdRegion: "KR" }),
  player({ id: "lucid", nickname: "Lucid", pageTitle: "Lucid (Choi Yong-hyeok)", gcdRegion: "KR" }),
  player({ id: "siwoo", nickname: "Siwoo", gcdRegion: "KR" }),
  player({ id: "smash", nickname: "Smash", pageTitle: "Smash (Shin Geum-jae)", gcdRegion: "KR" }),

  player({ id: "xun", nickname: "Xun", gcdRegion: "CN" }),
  player({ id: "on", nickname: "ON", gcdRegion: "CN" }),
  player({ id: "viper", nickname: "Viper", pageTitle: "Viper (Park Do-hyeon)", gcdRegion: "CN" }),
  player({ id: "369", nickname: "369", gcdRegion: "CN" }),
  player({ id: "tian", nickname: "Tian", gcdRegion: "CN", aliases: ["小天"] }),
  player({ id: "creme", nickname: "Creme", gcdRegion: "CN" }),
  player({ id: "rookie", nickname: "Rookie", gcdRegion: "CN", aliases: ["宋义进", "肉鸡"] }),
  player({ id: "wei", nickname: "Wei", pageTitle: "Wei (Yan Yang-Wei)", gcdRegion: "CN" }),
  player({ id: "photic", nickname: "Photic", gcdRegion: "CN" }),
  player({ id: "tarzan", nickname: "Tarzan", pageTitle: "Tarzan (Lee Seung-yong)", gcdRegion: "CN" }),
  player({ id: "flandre", nickname: "Flandre", gcdRegion: "CN" }),
  player({ id: "shanks", nickname: "Shanks", gcdRegion: "CN" }),
  player({ id: "hope", nickname: "Hope", pageTitle: "Hope (Wang Jie)", gcdRegion: "CN" }),
  player({ id: "kael", nickname: "Kael", pageTitle: "Kael (Kim Jin-hong)", gcdRegion: "CN" }),
  player({ id: "xiaohu", nickname: "Xiaohu", gcdRegion: "CN", aliases: ["李元浩", "小虎"] }),
  player({ id: "elk", nickname: "Elk", gcdRegion: "CN", aliases: ["Jiumeng", "旧梦"] }),
  player({ id: "jiejie", nickname: "jiejie", pageTitle: "Jiejie", gcdRegion: "CN" }),
  player({ id: "scout", nickname: "Scout", gcdRegion: "KR", aliases: ["李汭燦", "学弟"] }),
  player({ id: "missing", nickname: "MISSING", gcdRegion: "CN" }),

  player({ id: "razork", nickname: "Razork", gcdRegion: "EMEA" }),
  player({ id: "upset", nickname: "Upset", gcdRegion: "EMEA" }),
  player({ id: "vladi", nickname: "Vladi", gcdRegion: "EMEA" }),
  player({ id: "skewmond", nickname: "SkewMond", gcdRegion: "EMEA" }),
  player({ id: "labrov", nickname: "Labrov", gcdRegion: "EMEA" }),
  player({ id: "canna", nickname: "Canna", gcdRegion: "EMEA" }),
  player({ id: "yike", nickname: "Yike", gcdRegion: "EMEA" }),
  player({ id: "caliste", nickname: "Caliste", gcdRegion: "EMEA" }),
  player({ id: "busio", nickname: "Busio", gcdRegion: "EMEA" }),
  player({ id: "elyoya", nickname: "Elyoya", gcdRegion: "EMEA" }),
  player({ id: "jojopyun", nickname: "Jojopyun", gcdRegion: "EMEA" }),
  player({ id: "supa", nickname: "Supa", gcdRegion: "EMEA" }),
  player({ id: "alvaro", nickname: "Alvaro", pageTitle: "Alvaro (Álvaro Fernández)", gcdRegion: "EMEA" }),
  player({ id: "perkz", nickname: "Perkz", gcdRegion: "EMEA", aliases: ["阿P"] }),
  player({ id: "reapered", nickname: "Reapered", gcdRegion: "EMEA" }),

  player({ id: "thanatos", nickname: "Thanatos", pageTitle: "Thanatos (Park Seung-gyu)", gcdRegion: "AME" }),
  player({ id: "apa", nickname: "APA", pageTitle: "APA (Eain Stearns)", gcdRegion: "AME" }),
  player({ id: "quad", nickname: "Quad", gcdRegion: "AME" }),
  player({ id: "massu", nickname: "Massu", gcdRegion: "AME" }),
  player({ id: "corejj", nickname: "CoreJJ", gcdRegion: "AME" }),
  player({ id: "yeon", nickname: "Yeon", pageTitle: "Yeon (Sean Sung)", gcdRegion: "AME" }),
  player({ id: "impact", nickname: "Impact", gcdRegion: "AME" }),
  player({ id: "doublelift", nickname: "Doublelift", gcdRegion: "AME", aliases: ["DL"] }),
  player({ id: "bjergsen", nickname: "Bjergsen", gcdRegion: "AME", aliases: ["Bjerg"] }),

  player({ id: "uzi", nickname: "Uzi", pageTitle: "Uzi (Jian Zi-Hao)", gcdRegion: "CN", aliases: ["简自豪", "乌兹", "狂小狗"] }),
  player({ id: "clearlove", nickname: "Clearlove", gcdRegion: "CN", aliases: ["Clearlove7", "明凯", "厂长"] }),
  player({ id: "zz1tai", nickname: "Zz1tai", gcdRegion: "CN" }),
  player({ id: "kkoma", nickname: "kkOma", pageTitle: "KkOma", gcdRegion: "KR", gcdName: "kkOma" }),
  player({ id: "mata", nickname: "Mata", gcdRegion: "KR" }),
  player({ id: "homme", nickname: "Homme", gcdRegion: "KR" }),
  player({ id: "bengi", nickname: "Bengi", gcdRegion: "KR" }),
  player({ id: "madlife", nickname: "MadLife", gcdRegion: "KR" })
];

writeJson(TARGETS_PATH, {
  datasetVersion: "v1",
  players
});

console.log(JSON.stringify({
  targetFile: TARGETS_PATH,
  players: players.length,
  easyPlayers: players.filter((player) => player.difficulties.includes("easy")).length
}, null, 2));
