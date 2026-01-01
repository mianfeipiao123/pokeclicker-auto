#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
添加缺失翻译脚本
"""

import json

# 加载现有翻译
with open('../hardcoded/zh-Hans.map.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

entries = data.get('entries', {})

# 新增翻译（95个）
new_translations = {
    # Title 类型 (5个)
    "You don\\'t have any free egg slots.": "你没有空闲的蛋槽。",
    "Disable Auto Save?": "禁用自动保存？",
    "It\\'s a new day!": "新的一天开始了！",
    "<del>Emissary</del> Eater of Light": "<del>使者</del>光之吞噬者",
    "Require Complete Pokédex (recommended)": "需要完成图鉴（推荐）",

    # Single Quote 类型 (43个)
    "That sure is a tunnel.": "这确实是一条隧道。",
    "Disabling auto save will require you to manually save the game before exiting or any progress will be lost!\\r\\n\\r\\nProceed at your own risk.": "禁用自动保存后，你需要在退出前手动保存游戏，否则所有进度都会丢失！\\r\\n\\r\\n请自行承担风险。",
    "You are unable to use Flutes yet.\\n<i>Visit the Gym in Lavaridge Town.</i>": "你还不能使用笛子。\\n<i>请前往釜炎镇的道馆。</i>",
    "You do not have the Gem Case.\\n<i>Requires the Earth Badge.</i>": "你没有宝石盒。\\n<i>需要大地徽章。</i>",
    "You don\\'t have enough gems to use this Flute.": "你没有足够的宝石来使用这个笛子。",
    "You can\\'t use an evolution item on a Pokémon if it\\'s in the hatchery...": "如果宝可梦在孵化屋中，你无法对它使用进化道具...",
    "You need the Explorer Kit to access this location.\\n<i>Check out the shop at Cinnabar Island.</i>": "你需要探险套装才能进入此地点。\\n<i>请查看红莲岛的商店。</i>",
    "Thanks for hiring me,\\nI won\\'t let you down!": "感谢雇用我，\\n我不会让你失望的！",
    "Happy to work for you! Let me know when you\\'re hiring again!": "很高兴为你工作！下次招人时告诉我！",
    "Are you sure you want to leave?\\n\\nYou can always return later and start off where you left.": "你确定要离开吗？\\n\\n你可以稍后返回并从离开的地方继续。",
    "Are you sure?\\n\\nAll Pokémon will be removed from your breeding queue.": "你确定吗？\\n\\n所有宝可梦将从你的培育队列中移除。",
    "You don\\'t have any free egg slots": "你没有空闲的蛋槽",
    "You do not have access to the Day Care yet.\\n<i>Clear Route 3 first.</i>": "你还不能进入培育屋。\\n<i>请先通关3号道路。</i>",
    "Thanks for the work.\\nLet me know when you\\'re hiring again!": "感谢工作机会。\\n下次招人时告诉我！",
    "You can\\'t currently afford to hire me...": "你目前付不起雇用我的费用...",
    "You can\\'t access that dungeon right now!": "你现在无法进入那个地下城！",
    "Leave the dungeon?\\n\\nCurrent progress will be lost, but you will keep any items obtained from chests.": "离开地下城？\\n\\n当前进度将丢失，但你将保留从宝箱中获得的物品。",
    "All vitamins will be removed from <u>every</u> Pokémon in your party.": "所有营养剂将从你队伍中的<u>每只</u>宝可梦身上移除。",
    "Vitamins couldn\\'t be modified for Pokémon in Hatchery or Queue.": "无法修改孵化屋或队列中宝可梦的营养剂。",
    "Held items are one time use only.\\nRemoved items will be lost.\\nAre you sure you want to remove it?": "携带物品只能使用一次。\\n移除的物品将会丢失。\\n你确定要移除它吗？",
    "Please ensure you keep a backup of your old save as travelling through time can cause some serious problems.\\n\\nAny Pokémon you may have obtained in the future could cease to exist which could corrupt your save file!": "请确保备份你的旧存档，因为时间旅行可能会导致严重问题。\\n\\n你在未来获得的任何宝可梦都可能不复存在，这可能会损坏你的存档！",
    "Are you sure?\\n\\nYou can start the quest again later but you will lose all progress!": "你确定吗？\\n\\n你可以稍后重新开始任务，但会失去所有进度！",
    "Bill\\'s Grandpa has given you an Eevee, treat it well!": "比尔的爷爷给了你一只伊布，好好对待它！",
    "You have gained an Old Amber!\\n<i>Have a look around Cinnabar island to revive this fossil.</i>": "你获得了秘琥珀！\\n<i>去红莲岛看看如何复活这个化石。</i>",
    "Quest line completed!\\n<i>You have uncovered the Mystery of Deoxys!</i>": "任务线完成！\\n<i>你揭开了代欧奇希斯之谜！</i>",
    "Detective Pikachu\\'s partner has been nursed back to health!": "名侦探皮卡丘的搭档已经恢复健康！",
    "A Vivillon is hiding somewhere.\\nOnly the strongest Challengers can reach it.": "一只彩粉蝶藏在某处。\\n只有最强的挑战者才能找到它。",
    "You caught the last rare Vivillon (Poké Ball).\\nCongratulations!": "你捕获了最后一只稀有彩粉蝶（精灵球花纹）。\\n恭喜！",
    "Dr. Splash gives you a Saucy Blue Magikarp!": "水花博士给了你一只俏皮蓝鲤鱼王！",
    "You need the Safari Pass to access this location.\\n<i>Visit the Gym in Fuschia City</i>": "你需要狩猎通行证才能进入此地点。\\n<i>请前往紫苑市的道馆</i>",
    "Please paste the clipboard contents into a new \\'.txt\\' file.": "请将剪贴板内容粘贴到新的'.txt'文件中。",
    "Are you sure you want delete your save file?\\n\\nTo confirm, type \"DELETE\"": "你确定要删除存档吗？\\n\\n请输入\"DELETE\"确认",
    "You snagged a Magnet from Miror B\\'s Voltorb!": "你从镜像博士的霹雳电球那里抢到了磁铁！",
    "Can\\'t spin for more than 20 seconds, unless...": "不能旋转超过20秒，除非...",
    "Please only use saves from the main website https://pokeclicker.com/": "请只使用来自官方网站 https://pokeclicker.com/ 的存档",
    "New challenge mode added: Regional Attack Debuff.\\n\\nLowers Pokémon attack based on native region and highest reached region.\\n\\nThis is the default and recommended way to play, but is now an optional challenge.\\n\\nPlease choose if you would like this challenge mode to be enabled or disabled (cannot be re-enabled later)": "新增挑战模式：地区攻击削弱。\\n\\n根据宝可梦原产地区和已到达的最高地区降低攻击力。\\n\\n这是默认且推荐的游戏方式，但现在是可选挑战。\\n\\n请选择是否启用此挑战模式（之后无法重新启用）",
    "New challenge mode added: Require Complete Pokédex.\\n\\nRequires a complete regional pokédex before moving on to the next region.\\n\\nThis is the default and recommended way to play, but is now an optional challenge.\\n\\nPlease choose if you would like this challenge mode to be enabled or disabled (cannot be re-enabled later)": "新增挑战模式：需要完成图鉴。\\n\\n需要完成地区图鉴才能前往下一个地区。\\n\\n这是默认且推荐的游戏方式，但现在是可选挑战。\\n\\n请选择是否启用此挑战模式（之后无法重新启用）",
    "New challenge mode added: Slow EVs.\\n\\nDiminishes the rate at which EVs are gained.\\n\\nThis is an optional challenge and is NOT the recommended way to play.\\n\\nPlease choose if you would like this challenge mode to be disabled or enabled.\\n\\nCan be disabled later. Can NOT be enabled later!": "新增挑战模式：缓慢努力值。\\n\\n降低获得努力值的速度。\\n\\n这是可选挑战，不是推荐的游戏方式。\\n\\n请选择是否启用此挑战模式。\\n\\n之后可以禁用，但无法启用！",
    "A newer version of the game is available:\\n\\n<a class=\"btn btn-warning btn-block\" href=\"#\" onclick=\"location.reload(true);\">Reload Page</a>": "游戏有新版本可用：\\n\\n<a class=\"btn btn-warning btn-block\" href=\"#\" onclick=\"location.reload(true);\">重新加载页面</a>",
    "Please check the console for errors, and report them on our <a class=\"text-light\" href=\"https://discord.gg/a6DFe4p\"><u>Discord</u></a>.\\n\\nUnable to prepare backup save for download. Your save file is safe, but report this error as well.": "请检查控制台错误，并在我们的<a class=\"text-light\" href=\"https://discord.gg/a6DFe4p\"><u>Discord</u></a>上报告。\\n\\n无法准备备份存档下载。你的存档是安全的，但也请报告此错误。",
    "Are you sure you want to reset your save?\\n\\nThis cannot be undone, so please make sure you have a backup first!": "你确定要重置存档吗？\\n\\n此操作无法撤销，请确保先备份！",
    "Check the <a class=\"text-light\" href=\"#changelogModal\" data-toggle=\"modal\"><u>changelog</u></a> for details!\\n\\n<i>Failed to download old save. Please check the console for errors, and report them on our <a class=\"text-light\" href=\"https://discord.gg/a6DFe4p\"><u>Discord</u></a>.</i>": "查看<a class=\"text-light\" href=\"#changelogModal\" data-toggle=\"modal\"><u>更新日志</u></a>了解详情！\\n\\n<i>下载旧存档失败。请检查控制台错误，并在我们的<a class=\"text-light\" href=\"https://discord.gg/a6DFe4p\"><u>Discord</u></a>上报告。</i>",

    # Template 类型 (47个)
    "The enemy ${...} <img src=\"${...}\" height=\"24px\"/>": "敌方${...} <img src=\"${...}\" height=\"24px\"/>",
    "You opened the gift and received <img src=\"assets/images/currency/${...}.svg\" height=\"24px\"/> ${...}.": "你打开礼物并获得了 <img src=\"assets/images/currency/${...}.svg\" height=\"24px\"/> ${...}。",
    "You bought ${...} × <img src=\"${...}\" height=\"24px\"/> ${...}.": "你购买了 ${...} × <img src=\"${...}\" height=\"24px\"/> ${...}。",
    "You used ${...} × <img src=\"${...}\" height=\"24px\"/> ${...}${...} on ${...}.": "你对${...}使用了 ${...} × <img src=\"${...}\" height=\"24px\"/> ${...}${...}。",
    "${...}\\n\\n<strong>Start time:</strong> ${...}\\n<strong>End time:</strong> ${...}": "${...}\\n\\n<strong>开始时间：</strong> ${...}\\n<strong>结束时间：</strong> ${...}",
    "You traded for ${...} × <img src=\"${...}\" height=\"24px\"/> ${...}.": "你交易获得了 ${...} × <img src=\"${...}\" height=\"24px\"/> ${...}。",
    "<img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> ${...} found ${...} ${...}.": "<img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> ${...}发现了${...} ${...}。",
    "<img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> ${...}": "<img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> ${...}",
    "<img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> ${...} found ${...} ${...}, but the item was destroyed in the process.": "<img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> ${...}发现了${...} ${...}，但物品在过程中被损坏了。",
    "<b><img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> → <img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> Trade confirmed!</b><br/>${...}× ${...} → ${...}× ${...}.": "<b><img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> → <img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> 交易确认！</b><br/>${...}× ${...} → ${...}× ${...}。",
    "<b><img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> Sale Confirmed!</b><br/>${...}× ${...} has been boxed up for sale. Good choice, Trainer!": "<b><img src=\"${...}\" height=\"24px\" class=\"pixelated\"/> 出售确认！</b><br/>${...}× ${...}已打包出售。好选择，训练师！",
    "You've successfully defeated stage ${...} and earned:\\n<span><img src=\"${...}\" height=\"24px\"/> ${...}</span>!": "你成功击败了第${...}关并获得了：\\n<span><img src=\"${...}\" height=\"24px\"/> ${...}</span>！",
    "You managed to beat stage ${...}.\\nYou received <img src=\"./assets/images/currency/battlePoint.svg\" height=\"24px\"/> ${...}.\\nYou received <img src=\"./assets/images/currency/money.svg\" height=\"24px\"/> ${...}.": "你成功通过了第${...}关。\\n你获得了 <img src=\"./assets/images/currency/battlePoint.svg\" height=\"24px\"/> ${...}。\\n你获得了 <img src=\"./assets/images/currency/money.svg\" height=\"24px\"/> ${...}。",
    "You hatched ${...} ${...}!": "你孵化了${...} ${...}！",
    "You also found ${...} ${...} nearby!": "你还在附近发现了${...} ${...}！",
    "You don't have enough ${...} to hire me...\\nCost: <img src=\"./assets/images/currency/${...}.svg\" height=\"24px\"/> ${...}": "你没有足够的${...}来雇用我...\\n费用：<img src=\"./assets/images/currency/${...}.svg\" height=\"24px\"/> ${...}",
    "It looks like you are a little short on ${...} right now...\\nLet me know when you're hiring again!\\nCost: <img src=\"./assets/images/currency/${...}.svg\" height=\"24px\"/> ${...}": "看起来你现在${...}有点不够...\\n下次招人时告诉我！\\n费用：<img src=\"./assets/images/currency/${...}.svg\" height=\"24px\"/> ${...}",
    "You obtained a${...} ${...}!": "你获得了${...} ${...}！",
    "You need the ${...} to access this location.\\n<i>Clear Route 6 first.</i>": "你需要${...}才能进入此地点。\\n<i>请先通关6号道路。</i>",
    "You don't have enough Farm Points to hire me...\\nCost: <img src=\"./assets/images/currency/farmPoint.svg\" height=\"24px\"/> ${...}": "你没有足够的农场点数来雇用我...\\n费用：<img src=\"./assets/images/currency/farmPoint.svg\" height=\"24px\"/> ${...}",
    "It looks like you are a little short on Farm Points right now...\\nLet me know when you're hiring again!\\nCost: <img src=\"./assets/images/currency/farmPoint.svg\" height=\"24px\"/> ${...}": "看起来你现在农场点数有点不够...\\n下次招人时告诉我！\\n费用：<img src=\"./assets/images/currency/farmPoint.svg\" height=\"24px\"/> ${...}",
    "Here's your bill for the hour!\\nCost: <img src=\"./assets/images/currency/farmPoint.svg\" height=\"24px\"/> ${...}": "这是你的小时账单！\\n费用：<img src=\"./assets/images/currency/farmPoint.svg\" height=\"24px\"/> ${...}",
    "You found ${...} ${...} Berry!": "你发现了${...} ${...}树果！",
    "Defeated: ${...} Pokémon\\nEarned: <img src=\"./assets/images/currency/money.svg\" height=\"24px\"/> ${...}": "击败：${...}只宝可梦\\n获得：<img src=\"./assets/images/currency/money.svg\" height=\"24px\"/> ${...}",
    "Gained ${...} Dream Orbs while offline:<br /><ul class=\"mb-0\">${...}</ul>": "离线期间获得了${...}个梦境球：<br /><ul class=\"mb-0\">${...}</ul>",
    "Your ${...} evolved into ${...} ${...}!": "你的${...}进化成了${...} ${...}！",
    "You have captured ${...} ${...}!": "你捕获了${...} ${...}！",
    "${...} couldn\\'t be modified for Pokémon in Hatchery or Queue.": "${...}无法修改孵化屋或队列中的宝可梦。",
    "You have completed your quest!\\nYou claimed <img src=\"./assets/images/currency/questPoint.svg\" height=\"24px\"/> ${...}!": "你完成了任务！\\n你获得了 <img src=\"./assets/images/currency/questPoint.svg\" height=\"24px\"/> ${...}！",
    "You can complete your quest for <img src=\"./assets/images/currency/questPoint.svg\" height=\"24px\"/> ${...}!": "你可以完成任务获得 <img src=\"./assets/images/currency/questPoint.svg\" height=\"24px\"/> ${...}！",
    "${...}\\n<i>\"${...}\" added to the Quest List!</i>": "${...}\\n<i>\"${...}\"已添加到任务列表！</i>",
    "<img width=\"60\" src=\"assets/images/items/zCrystal/${...}.svg\"/> You got the ${...}!": "<img width=\"60\" src=\"assets/images/items/zCrystal/${...}.svg\"/> 你获得了${...}！",
    "A Vivillon is hiding somewhere.\\n${...}": "一只彩粉蝶藏在某处。\\n${...}",
    "All quests completed. Your quest list has been refreshed and you gained an extra <img src=\"./assets/images/currency/questPoint.svg\" height=\"24px\"/> ${...}.": "所有任务已完成。你的任务列表已刷新，你额外获得了 <img src=\"./assets/images/currency/questPoint.svg\" height=\"24px\"/> ${...}。",
    "Your quest level has increased to ${...}!\\n<i>You have a free quest refresh.</i>": "你的任务等级提升到${...}！\\n<i>你有一次免费任务刷新。</i>",
    "You have an active Safari in ${...}.\\nDo you want to quit that Safari and start a new one?": "你在${...}有一个进行中的狩猎区。\\n你想退出那个狩猎区并开始新的吗？",
    "You found ${...} ${...}!": "你发现了${...} ${...}！",
    "<img src=\"assets/images/currency/contestToken.svg\" height=\"24px\"/> You earned ${...} Contest Tokens!": "<img src=\"assets/images/currency/contestToken.svg\" height=\"24px\"/> 你获得了${...}个竞赛代币！",
    "Please update your game before attempting to load this save..\\n\\nSave version: ${...}\\nGame version: ${...}": "请在加载此存档前更新游戏..\\n\\n存档版本：${...}\\n游戏版本：${...}",
    "Please check the console for errors, and report them on our <a class=\"text-light\" href=\"https://discord.gg/a6DFe4p\"><u>Discord</u></a> along with your save file.\\n\\n${...}\\n${...}": "请检查控制台错误，并在我们的<a class=\"text-light\" href=\"https://discord.gg/a6DFe4p\"><u>Discord</u></a>上报告，同时附上你的存档。\\n\\n${...}\\n${...}",
    "Check the <a class=\"text-light\" href=\"#changelogModal\" data-toggle=\"modal\"><u>changelog</u></a> for details!\\n\\n${...}": "查看<a class=\"text-light\" href=\"#changelogModal\" data-toggle=\"modal\"><u>更新日志</u></a>了解详情！\\n\\n${...}",
    "You don't have access to that route yet.\\n<i>${...}</i>": "你还不能进入该道路。\\n<i>${...}</i>",
    "You don't have access to that location yet.\\n<i>${...}</i>": "你还不能进入该地点。\\n<i>${...}</i>",
    "You don't have access yet.\\n<i>${...}</i>": "你还没有访问权限。\\n<i>${...}</i>",
}

# 添加新翻译
added_count = 0
for key, value in new_translations.items():
    if key not in entries:
        entries[key] = value
        added_count += 1

# 保存
data['entries'] = entries
with open('../hardcoded/zh-Hans.map.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"添加了 {added_count} 条新翻译")
print(f"翻译文件现有 {len(entries)} 条翻译")
