/**
 * 分类翻译脚本
 * 将 zh-Hans.map.json 按游戏源代码结构拆分成多个文件
 */

const fs = require('fs');
const path = require('path');

// 配置
const INPUT_FILE = path.join(__dirname, '../hardcoded/zh-Hans.map.json');
const OUTPUT_DIR = path.join(__dirname, '../zh-Hans');

// 分类规则（按优先级排序，越具体的规则越靠前）
const CATEGORIES = {
  // 首先过滤掉不应翻译的内容
  'misc/code': {
    patterns: [
      /^[a-f0-9]{6}$/, // 颜色代码
      /^#[a-f0-9]{3,6}$/i,
      /^\.[\w-]+$/, // CSS 选择器
      /^:[\w(),-]+$/, // CSS 伪类
      /^--[\w-]+$/, // CSS 变量
      /Filter$/, /^pokeball/, /^pokedex/, /^breeding/, /^farm[A-Z]/,
      /^\w+Template$/, /^\w+View$/, /^\w+Modal$/,
      /^[\w]+_[\w]+_[\w]+$/, // 下划线变量名
      /^\$\{/, // 模板变量
      /^[A-Z][a-z]+_[A-Z]/, // 常量命名
      /^[a-z]+[A-Z][a-z]+$/, // camelCase 变量
      /^JU[A-Z0-9]+$/, // 编码字符串
    ],
    keywords: [],
  },

  // 任务/目标
  'modules/quests': {
    patterns: [
      /^Capture \d+/, /^Catch \d+/, /^Defeat \d+/, /^Hatch \d+/,
      /^Capture a total/, /^Catch all/, /^Capture or hatch/,
      /^Catch or hatch/, /unique Pokémon/, /unique Shiny/,
      /^Defeat the /, /^Find the /, /^Clear the /,
    ],
    keywords: [],
  },

  // scripts/
  'scripts/dungeons': {
    patterns: [
      /^Viridian Forest$/, /^Mt\. Moon$/, /^Diglett's Cave$/,
      /Dungeon/, /Cave$/, /Tower$/, /Ruins$/, /Temple$/, /Shrine$/,
      /Forest$/, /Tunnel$/, /Grotto$/, /Lair$/, /Den$/, /Depths$/,
      /^Power Plant$/, /^Seafoam Islands$/, /^Victory Road$/,
      /dungeon/i, /^Clear /, /loot/i, /boss/i,
      /Cavern$/, /Crypt$/, /Labyrinth/, /Maze$/,
    ],
    keywords: ['Dungeon', 'Cave', 'Tower', 'Forest', 'Ruins', 'Temple', 'Grotto'],
  },
  'scripts/gym': {
    patterns: [
      /Gym$/, /Gym Leader/, /Elite Four/, /Champion /, /Badge$/,
      /^Brock$/, /^Misty$/, /^Lt\. Surge$/, /^Erika$/, /^Koga$/, /^Sabrina$/, /^Blaine$/, /^Giovanni$/,
      /'s Gym/, /Gym at /, /Trial$/, /Kahuna/,
    ],
    keywords: ['Gym', 'Badge', 'Elite Four', 'Champion', 'Leader', 'Trial'],
  },
  'scripts/towns': {
    patterns: [
      /Town$/, /City$/, /Village$/, /Island$/,
      /^Pallet Town$/, /^Viridian City$/, /^Pewter City$/,
      /Center$/, /^Pokemon League/, /Pokémon League/,
      /Harbor$/, /Port$/, /Station$/, /Airport$/,
    ],
    keywords: ['Town', 'City', 'Village', 'Island'],
  },
  'scripts/temporaryBattle': {
    patterns: [
      /^Blue \d+$/, /^Rival /, /^Team /, /Grunt/, /Admin/,
      /^Giovanni /, /^N /, /^Colress /, /^Ghetsis /,
      /^Cipher /, /^Rocket /, /^Plasma /, /^Galactic /, /^Magma /, /^Aqua /,
      /^Aether /, /^Skull /, /^Flare /, /^Yell /,
      /^[A-Z][a-z]+ \d$/, // 人名 + 单个数字 (Calem 1, Kyurem 2)
      /^[A-Z][a-z]+ & [A-Z][a-z]+$/, // 双人战斗 (Jack & Briana)
      /^Sordward/, /^Shielbert/, /^Klara \d/, /^Avery \d/,
    ],
    keywords: ['Rival', 'Team Rocket', 'Team Plasma', 'Team Galactic', 'Grunt', 'Cipher'],
  },
  'scripts/farming': {
    patterns: [
      /Berry$/, /Mulch$/, /Farm/, /Harvest/, /Plant/, /Grow/,
      /Aura/, /Mutation/, /Wither/, /Ripe/, /Sprout/,
    ],
    keywords: ['Berry', 'Mulch', 'Farm', 'Harvest', 'Plant', 'Aura'],
  },
  'scripts/safari': {
    patterns: [
      /Safari/, /Wild Area/, /Bait/,
      /Great Marsh/, /Friend Safari/,
    ],
    keywords: ['Safari', 'Wild Area'],
  },
  'scripts/battleFrontier': {
    patterns: [
      /Battle Frontier/, /Battle Tower/, /Battle Factory/,
      /Frontier Brain/, /Battle Point/, /Battle Arcade/,
      /Battle Castle/, /Battle Hall/, /Battle Pike/,
    ],
    keywords: ['Battle Frontier', 'Battle Tower', 'Frontier', 'Battle Point'],
  },
  'scripts/shop': {
    patterns: [
      /^Buy /, /^Sell /, /^Purchase/, /Shop$/, /Store$/, /Mart$/,
      /Price/, /Cost/, /Discount/, /^Game Corner/,
    ],
    keywords: ['Shop', 'Store', 'Mart', 'Buy', 'Sell', 'Price'],
  },

  // modules/
  'modules/items': {
    patterns: [
      /Ball$/, /Stone$/, /^Master Ball$/, /^Great Ball$/, /^Ultra Ball$/,
      /Incense$/, /^X Attack$/, /^X Click$/, /^Lucky Egg$/,
      /Restore$/, /Potion$/, /Ether$/, /Elixir$/, /Revive$/,
      /^Protein$/, /^Calcium$/, /^Carbos$/, /^Iron$/, /^Zinc$/, /^HP Up$/,
      /Fossil$/, /Shard$/, /Gem$/, /^Held Item/,
      /ite$/, // Mega stones
      /Flute$/, /Orb$/, /Plate$/, /Memory$/, /Z$/,
      /Feather$/, /Barb$/, /Scroll$/,
      /^[A-Z][a-z]+_[a-z]+$/, // 下划线物品名 (Smooth_rock, Key_stone)
    ],
    keywords: ['Ball', 'Stone', 'Potion', 'Restore', 'Fossil', 'Shard', 'Gem', 'Flute', 'Memory'],
  },
  'modules/routes': {
    patterns: [
      /^Kanto Route/, /^Johto Route/, /^Hoenn Route/, /^Sinnoh Route/,
      /^Unova Route/, /^Kalos Route/, /^Alola Route/, /^Galar Route/,
      /^Paldea Route/, /^Hisui /,
      /Route \d+ in /, /^Route \d+$/,
    ],
    keywords: [],
  },
  'modules/achievements': {
    patterns: [
      /Achievement/, /\[Achievement\]/, /Master$/,
      /Caught all/, /Defeated all/, /Completed all/,
    ],
    keywords: ['Achievement'],
  },
  'modules/breeding': {
    patterns: [
      /Egg$/, /Hatch/, /Breed/, /Nursery/, /Day Care/, /Hatchery/,
      /Queue/, /Steps/, /Incubat/,
    ],
    keywords: ['Egg', 'Hatch', 'Breed', 'Nursery', 'Hatchery'],
  },
  'modules/underground': {
    patterns: [
      /Underground/, /Mining/, /Dig/, /Excavate/, /Layer/,
      /Treasure/, /^Fossil/,
    ],
    keywords: ['Underground', 'Mining', 'Dig', 'Excavate'],
  },
  'modules/pokeballs': {
    patterns: [
      /^Poké Ball$/, /^Great Ball$/, /^Ultra Ball$/, /^Master Ball$/,
      /^Fast Ball$/, /^Quick Ball$/, /^Timer Ball$/, /^Dusk Ball$/,
      /^Luxury Ball$/, /^Dive Ball$/, /^Lure Ball$/, /^Nest Ball$/,
      /^Safari Ball$/, /^Sport Ball$/, /^Dream Ball$/, /^Beast Ball$/,
    ],
    keywords: [],
  },
  'modules/types': {
    patterns: [
      /^Normal$/, /^Fire$/, /^Water$/, /^Electric$/, /^Grass$/, /^Ice$/,
      /^Fighting$/, /^Poison$/, /^Ground$/, /^Flying$/, /^Psychic$/,
      /^Bug$/, /^Rock$/, /^Ghost$/, /^Dragon$/, /^Dark$/, /^Steel$/, /^Fairy$/,
      /^Normal type/, /^Fire type/, /type Pokémon/,
    ],
    keywords: [],
  },

  // components/
  'components/ui': {
    patterns: [
      /^OK$/, /^Cancel$/, /^Close$/, /^Save$/, /^Load$/, /^Delete$/,
      /^Yes$/, /^No$/, /^Confirm$/, /^Back$/, /^Next$/, /^Previous$/,
      /^Start$/, /^Stop$/, /^Pause$/, /^Resume$/, /^Reset$/,
      /^Enable$/, /^Disable$/, /^On$/, /^Off$/, /^Toggle$/,
      /^Filter$/, /^Sort$/, /^Search$/, /^Clear$/,
      /^Settings$/, /^Options$/, /^Menu$/, /^Help$/,
      /^Loading/, /^Please wait/, /^Error/, /^Warning/, /^Success$/,
      /^Total/, /^Amount/, /^Level/, /^Status/, /^Info/,
      /^Show /, /^Hide /, /^Select /, /^Choose /,
    ],
    keywords: ['OK', 'Cancel', 'Close', 'Save', 'Load', 'Settings', 'Menu', 'Filter', 'Sort'],
  },

  // misc/
  'misc/shadow': {
    patterns: [
      /^Shadow /, /暗影/, /Purif/, /XD/, /Colosseum/,
      /^Orre /, /Cipher/, /Snag/,
    ],
    keywords: ['Shadow', '暗影', 'Purify', 'Cipher'],
  },
  'misc/notifications': {
    patterns: [
      /^You /, /^Your /, /!\s*$/,
      /discovered/, /found a/, /caught a/, /captured/,
      /hatched/, /evolved/, /completed/, /unlocked/,
      /obtained/, /received/, /earned/,
    ],
    keywords: [],
  },
  'misc/dialogues': {
    patterns: [
      /\.\.\.$/, // 对话通常以...结尾
      /^".*"$/, // 引号包围的文本
      /I'll /, /I'm /, /I've /, /You're /, /You've /, /We're /, /We've /,
      /^Oh,? /, /^Ah,? /, /^Well,? /, /^Hey,? /, /^Hi,? /, /^Hello/,
      /^Thank/, /^Sorry/, /^Please/, /^Welcome/,
      /my friend/, /young one/, /trainer/i,
    ],
    keywords: [],
  },
  'misc/changelog': {
    patterns: [
      /^v\d+\.\d+/, /^Version /, /^Update /,
      /added$/, /fixed$/, /changed$/, /removed$/, /improved$/,
      /now (?:can|has|is|are|will)/, /no longer/,
      /bug fix/i, /hotfix/i, /patch/i,
      /^Can (?:filter|now|sort|see|re-order|obtain|hide)/, // Can filter..., Can now...
      /^Some .* not /, // Some ... not working/showing
      /not showing/, /not working/, /not appearing/,
    ],
    keywords: ['changelog', 'update', 'fix', 'added', 'removed'],
  },
  'misc/npcs': {
    patterns: [
      /^[A-Z][a-z]+$/, // 单个首字母大写的单词（可能是人名）
      /^Prof\. /, /^Professor /, /^Dr\. /, /^Mr\. /, /^Mrs\. /, /^Ms\. /,
      /^Ace Trainer/, /^Beauty /, /^Hiker /, /^Youngster /, /^Lass /,
      /^Swimmer /, /^Fisherman /, /^Bug Catcher/, /^Pokéfan/,
      /^Scientist /, /^Ranger /, /^Breeder /, /^Collector /,
      /^Kimono Girl/, /^Pokéfan /,
    ],
    keywords: ['Professor', 'Trainer', 'Leader'],
  },
  'misc/locations': {
    patterns: [
      /^[A-Z][a-z]+ [A-Z][a-z]+$/, // 两个单词的地名
      /Path$/, /Road$/, /Way$/, /Street$/, /Avenue$/,
      /Beach$/, /Coast$/, /Shore$/, /Lake /, /River$/, /Sea$/,
      /Mountain$/, /Hill$/, /Valley$/, /Plain$/, /Field$/,
      /Garden$/, /Park$/, /Plaza$/, /Square$/,
      /Camp$/, /Base$/, /Lab$/, /Laboratory$/,
      /Province/, /Slope$/, /Retreat$/, /Spring$/, /Manor$/, /Stadium$/,
      /Outskirts$/, /Bay$/, /Lighthouse$/,
    ],
    keywords: [],
  },
};

// 读取输入文件
function readInputFile() {
  const content = fs.readFileSync(INPUT_FILE, 'utf8');
  return JSON.parse(content);
}

// 判断条目属于哪个分类
function categorize(key, value) {
  const text = key + ' ' + (value || '');

  for (const [category, rules] of Object.entries(CATEGORIES)) {
    // 检查模式匹配
    for (const pattern of rules.patterns) {
      if (pattern.test(key)) {
        return category;
      }
    }
    // 检查关键词
    for (const keyword of rules.keywords) {
      if (key.includes(keyword) || (value && value.includes(keyword))) {
        return category;
      }
    }
  }

  return 'misc/uncategorized';
}

// 创建输出目录结构
function createOutputDirs() {
  const dirs = [
    'scripts', 'modules', 'components', 'misc'
  ];

  for (const dir of dirs) {
    const fullPath = path.join(OUTPUT_DIR, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}

// 主函数
function main() {
  console.log('读取输入文件...');
  const data = readInputFile();
  const entries = data.entries || data;

  console.log(`共 ${Object.keys(entries).length} 条翻译`);

  // 创建输出目录
  createOutputDirs();

  // 分类
  const categorized = {};
  const stats = {};

  for (const [key, value] of Object.entries(entries)) {
    const category = categorize(key, value);

    if (!categorized[category]) {
      categorized[category] = {};
      stats[category] = 0;
    }

    categorized[category][key] = value;
    stats[category]++;
  }

  // 输出分类结果
  console.log('\n分类统计:');
  const fileInfo = {};

  for (const [category, items] of Object.entries(categorized)) {
    const filePath = path.join(OUTPUT_DIR, category + '.json');
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const output = {
      _meta: {
        category: category,
        count: Object.keys(items).length,
        generatedAt: new Date().toISOString(),
      },
      entries: items,
    };

    fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`  ${category}: ${stats[category]} 条`);

    fileInfo[category + '.json'] = {
      entries: Object.keys(items).length,
      lastUpdated: new Date().toISOString().split('T')[0],
    };
  }

  // 生成索引文件
  const index = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    files: fileInfo,
    stats: {
      totalEntries: Object.keys(entries).length,
      categories: Object.keys(categorized).length,
    },
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_index.json'),
    JSON.stringify(index, null, 2),
    'utf8'
  );

  console.log('\n完成! 索引文件已生成: _index.json');
}

main();
