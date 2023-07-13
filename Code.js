const BOT_TOKEN =
  PropertiesService.getScriptProperties().getProperty("botToken");
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/`;
const BMC_URL = "https://www.buymeacoffee.com/mdnaimur";
const WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbwxgW8ur_JH19DdjKA96aBN0r74JkYEkiWvXfOA9rDvk0rg-GS6AKPNxT_e8w0Z37Xs4w/exec";

const userSheet = SpreadsheetApp.openById(
  "1C7cNMlG468pAqN9pYllYR15ZjCR0rJi3Jh42R7lD670"
).getSheetByName("Users");

// For local work
// const { tgbot } = require("google-apps-script-telegram-bot-library");
// var bot = new tgbot(BOT_TOKEN);

// For google apps script
var bot = new TGbot.tgbot(BOT_TOKEN);

function test() {
  var text = Math.ceil(5.01);
  Logger.log(text);
}

function doPost(e) {
  if (!e.postData || !e.postData.contents) return;
  var update = JSON.parse(e.postData.contents);
  if (update.message) {
    if (update.message.text.startsWith("/")) handleCommand(update);
    else handleNonCommand(update);
  } else if (update.callback_query) {
    handleCallbackQuery(update.callback_query);
  }
}

function handleCommand(update) {
  var command = update.message.text;
  var chatId = update.message.from.id;
  if (command == "/start") {
    bot.sendMessage({
      chat_id: chatId,
      text: "Hello there, I can translate text for you from any language to another.",
    });
  } else if (command == "/set") {
    bot.sendMessage({
      chat_id: chatId,
      text: "Select default language for text to be translated to:",
      reply_markup: getLanguageButtonsMarkup(1, chatId),
    });
  } else if (command == "/list") {
    var text = "";
    languages.forEach((lang) => {
      text = text + "\n" + lang.code + " -> " + lang.name;
    });
    bot.sendMessage({
      chat_id: chatId,
      text: `All supported languages are listed here:\n<b>Language Code -> Language name</b>\n ${text}`,
      parse_mode: "html",
    });
  } else if (command == "/remove") {
    resetDefaultLanguage(chatId);
    bot.sendMessage({
      chat_id: chatId,
      text: "Custom language removed and translation language is reset to English (en)",
    });
  } else if (command == "/help") {
    var text = `Hi ${update.message.from.first_name},\n\nYou can send me any text that you want to translate. Please follow the following format.\n\n\`text to translate | language-code\`\n\nExample: \`Hello there | bn\`\n\nUse /list to know language codes.\n\n_If you do not specify any language code, the given text will be translated to English or the default language you have set using_ /set.`;
    bot.sendMessage({ chat_id: chatId, text: text, parse_mode: "markdown" });
  } else {
    bot.sendMessage({
      chat_id: chatId,
      reply_to_message_id: update.message.message_id,
      text: "Invalid command!",
    });
  }
}

function handleNonCommand(update) {
  var message = update.message;
  var msgId = message.message_id;
  var chatId = message.from.id;
  var text = message.text;
  var response = "Sorry! I couldn't translate your text.";
  if (text) {
    var textToTranslate = text;
    var toLang = "";
    if (text.includes("|")) {
      var split = text.split("|");
      textToTranslate = split[0].trim();
      toLang = split[1].trim();
    } else {
      toLang = getDefaultLanguage(chatId);
    }
    if (textToTranslate.trim() === "") {
      response = "No text to translate!";
    } else {
      try {
        response = LanguageApp.translate(textToTranslate, "", toLang);
      } catch (error) {
        Logger.log(error);
      }
    }
  } else {
    response = "Unsupported message format!";
  }
  bot.sendMessage({
    chat_id: chatId,
    reply_to_message_id: msgId,
    text: response,
  });
}

function handleCallbackQuery(query) {
  var from = query.from;
  var chatId = from.id;
  var msgId = query.message.message_id;
  var name = from.first_name + (from.last_name ? " " + from.last_name : "");
  var data = query.data;
  if (data.startsWith("/set")) {
    var langCode = data.substr(5);
    var offset = parseInt(langCode);
    if (offset) {
      bot.editMessageText({
        chat_id: chatId,
        message_id: msgId,
        text: "Select default language for text to be translated to:",
        reply_markup: getLanguageButtonsMarkup(offset, chatId),
      });
      bot.editMessageText()
      return;
    }
    saveDefaultLanguage(chatId, name, langCode);
    var langName = "";
    for (var i = 0; i < languages.length; i++) {
      if (languages[i].code == langCode) {
        langName = languages[i].name;
        break;
      }
    }
    bot.editMessageText({
      chat_id: chatId,
      message_id: msgId,
      text: `Successfully set the language to ${langName} (${langCode})`,
    });
  }
}

function getLanguageButtonsMarkup(offset, chatId) {
  var buttons = [];
  var row = [];
  var defaultLang = getDefaultLanguage(chatId);
  var list = getLanguageList(offset);
  for (var i = 0; i < list.length; i++) {
    var lang = list[i];
    var btn = {
      text: lang.code === defaultLang ? "✅ " + lang.name : lang.name,
      callback_data: "/set " + lang.code,
    };
    if (row.length < 3) {
      row.push(btn);
    } else {
      buttons.push(row);
      row = [];
      row.push(btn);
    }
  }
  buttons.push(row);
  row = [];
  if (offset > 1) {
    row.push({ text: "<-", callback_data: `/set ${offset - 1}` });
  }
  if (offset < Math.ceil(languages.length / 24)) {
    row.push({ text: "->", callback_data: `/set ${offset + 1}` });
  }
  buttons.push(row);
  return { 'inline_keyboard': buttons };
}

function getLanguageList(offset) {
  var length = languages.length;
  var maxOffset = Math.ceil(length / 24);
  if (offset < maxOffset) {
    return languages.slice((offset - 1) * 24, offset * 24);
  } else {
    return languages.slice((offset - 1) * 24, length);
  }
}

// sheet realted methods

function saveDefaultLanguage(chatId, userName, language) {
  var chatIdColumn = userSheet.getRange("A:A").getValues().flat();
  var index = chatIdColumn.indexOf(chatId);
  if (index > -1) {
    userSheet.getRange(index + 1, 3).setValue(language);
  } else {
    userSheet.appendRow([chatId, userName, language]);
  }
}

function getDefaultLanguage(chatId) {
  var chatIdColumn = userSheet.getRange("A:A").getValues().flat();
  var defaultLanguageColumn = userSheet.getRange("C:C").getValues().flat();
  var index = chatIdColumn.indexOf(chatId);
  if (index > -1) {
    return defaultLanguageColumn[index];
  }
  return "en";
}

function resetDefaultLanguage(chatId) {
  var chatIdColumn = userSheet.getRange("A:A").getValues().flat();
  var index = chatIdColumn.indexOf(chatId);
  if (index > -1) {
    userSheet.getRange(index + 1, 3).setValue("en");
  }
}

// Utilities

function getCurrentDate() {
  var timeZone = Session.getScriptTimeZone();
  return Utilities.formatDate(new Date(), timeZone, "dd/MM/yyyy HH:mm:ss");
}

// Sheet tasks
function saveRequest(update) {
  var chat = update.message.chat;

  var date = getCurrentDate();
  var chatId = chat.id;
  var name = chat.first_name + (chat.last_name ? " " + chat.last_name : "");
  var username = chat.username;
  var message = update.message.text;
  sheet.appendRow([date, chatId, name, username, message]);
}

// Values

const languages = [
  {
    name: "Afrikaans",
    code: "af",
  },
  {
    name: "Albanian",
    code: "sq",
  },
  {
    name: "Amharic",
    code: "am",
  },
  {
    name: "Arabic",
    code: "ar",
  },
  {
    name: "Armenian",
    code: "hy",
  },
  {
    name: "Assamese*",
    code: "as",
  },
  {
    name: "Aymara*",
    code: "ay",
  },
  {
    name: "Azerbaijani",
    code: "az",
  },
  {
    name: "Bambara*",
    code: "bm",
  },
  {
    name: "Basque",
    code: "eu",
  },
  {
    name: "Belarusian",
    code: "be",
  },
  {
    name: "Bengali",
    code: "bn",
  },
  {
    name: "Bhojpuri*",
    code: "bho",
  },
  {
    name: "Bosnian",
    code: "bs",
  },
  {
    name: "Bulgarian",
    code: "bg",
  },
  {
    name: "Catalan",
    code: "ca",
  },
  {
    name: "Cebuano",
    code: "ceb",
  },
  {
    name: "Chinese (Simplified)",
    code: "zh-CN",
  },
  {
    name: "Chinese (Traditional)",
    code: "zh-TW",
  },
  {
    name: "Corsican",
    code: "co",
  },
  {
    name: "Croatian",
    code: "hr",
  },
  {
    name: "Czech",
    code: "cs",
  },
  {
    name: "Danish",
    code: "da",
  },
  {
    name: "Dhivehi*",
    code: "dv",
  },
  {
    name: "Dogri*",
    code: "doi",
  },
  {
    name: "Dutch",
    code: "nl",
  },
  {
    name: "English",
    code: "en",
  },
  {
    name: "Esperanto",
    code: "eo",
  },
  {
    name: "Estonian",
    code: "et",
  },
  {
    name: "Ewe*",
    code: "ee",
  },
  {
    name: "Filipino (Tagalog)",
    code: "fil",
  },
  {
    name: "Finnish",
    code: "fi",
  },
  {
    name: "French",
    code: "fr",
  },
  {
    name: "Frisian",
    code: "fy",
  },
  {
    name: "Galician",
    code: "gl",
  },
  {
    name: "Georgian",
    code: "ka",
  },
  {
    name: "German",
    code: "de",
  },
  {
    name: "Greek",
    code: "el",
  },
  {
    name: "Guarani*",
    code: "gn",
  },
  {
    name: "Gujarati",
    code: "gu",
  },
  {
    name: "Haitian Creole",
    code: "ht",
  },
  {
    name: "Hausa",
    code: "ha",
  },
  {
    name: "Hawaiian",
    code: "haw",
  },
  {
    name: "Hebrew",
    code: "he",
  },
  {
    name: "Hindi",
    code: "hi",
  },
  {
    name: "Hmong",
    code: "hmn",
  },
  {
    name: "Hungarian",
    code: "hu",
  },
  {
    name: "Icelandic",
    code: "is",
  },
  {
    name: "Igbo",
    code: "ig",
  },
  {
    name: "Ilocano*",
    code: "ilo",
  },
  {
    name: "Indonesian",
    code: "id",
  },
  {
    name: "Irish",
    code: "ga",
  },
  {
    name: "Italian",
    code: "it",
  },
  {
    name: "Japanese",
    code: "ja",
  },
  {
    name: "Javanese",
    code: "jv",
  },
  {
    name: "Kannada",
    code: "kn",
  },
  {
    name: "Kazakh",
    code: "kk",
  },
  {
    name: "Khmer",
    code: "km",
  },
  {
    name: "Kinyarwanda",
    code: "rw",
  },
  {
    name: "Konkani*",
    code: "gom",
  },
  {
    name: "Korean",
    code: "ko",
  },
  {
    name: "Krio*",
    code: "kri",
  },
  {
    name: "Kurdish",
    code: "ku",
  },
  {
    name: "Kurdish (Sorani)*",
    code: "ckb",
  },
  {
    name: "Kyrgyz",
    code: "ky",
  },
  {
    name: "Lao",
    code: "lo",
  },
  {
    name: "Latin",
    code: "la",
  },
  {
    name: "Latvian",
    code: "lv",
  },
  {
    name: "Lingala*",
    code: "ln",
  },
  {
    name: "Lithuanian",
    code: "lt",
  },
  {
    name: "Luganda*",
    code: "lg",
  },
  {
    name: "Luxembourgish",
    code: "lb",
  },
  {
    name: "Macedonian",
    code: "mk",
  },
  {
    name: "Maithili*",
    code: "mai",
  },
  {
    name: "Malagasy",
    code: "mg",
  },
  {
    name: "Malay",
    code: "ms",
  },
  {
    name: "Malayalam",
    code: "ml",
  },
  {
    name: "Maltese",
    code: "mt",
  },
  {
    name: "Maori",
    code: "mi",
  },
  {
    name: "Marathi",
    code: "mr",
  },
  {
    name: "Meiteilon (Manipuri)*",
    code: "mni-Mtei",
  },
  {
    name: "Mizo*",
    code: "lus",
  },
  {
    name: "Mongolian",
    code: "mn",
  },
  {
    name: "Myanmar (Burmese)",
    code: "my",
  },
  {
    name: "Nepali",
    code: "ne",
  },
  {
    name: "Norwegian",
    code: "no",
  },
  {
    name: "Nyanja (Chichewa)",
    code: "ny",
  },
  {
    name: "Odia (Oriya)",
    code: "or",
  },
  {
    name: "Oromo*",
    code: "om",
  },
  {
    name: "Pashto",
    code: "ps",
  },
  {
    name: "Persian",
    code: "fa",
  },
  {
    name: "Polish",
    code: "pl",
  },
  {
    name: "Portuguese (Portugal, Brazil)",
    code: "pt",
  },
  {
    name: "Punjabi",
    code: "pa",
  },
  {
    name: "Quechua*",
    code: "qu",
  },
  {
    name: "Romanian",
    code: "ro",
  },
  {
    name: "Russian",
    code: "ru",
  },
  {
    name: "Samoan",
    code: "sm",
  },
  {
    name: "Sanskrit*",
    code: "sa",
  },
  {
    name: "Scots Gaelic",
    code: "gd",
  },
  {
    name: "Sepedi*",
    code: "nso",
  },
  {
    name: "Serbian",
    code: "sr",
  },
  {
    name: "Sesotho",
    code: "st",
  },
  {
    name: "Shona",
    code: "sn",
  },
  {
    name: "Sindhi",
    code: "sd",
  },
  {
    name: "Sinhala (Sinhalese)",
    code: "si",
  },
  {
    name: "Slovak",
    code: "sk",
  },
  {
    name: "Slovenian",
    code: "sl",
  },
  {
    name: "Somali",
    code: "so",
  },
  {
    name: "Spanish",
    code: "es",
  },
  {
    name: "Sundanese",
    code: "su",
  },
  {
    name: "Swahili",
    code: "sw",
  },
  {
    name: "Swedish",
    code: "sv",
  },
  {
    name: "Tagalog (Filipino)",
    code: "tl",
  },
  {
    name: "Tajik",
    code: "tg",
  },
  {
    name: "Tamil",
    code: "ta",
  },
  {
    name: "Tatar",
    code: "tt",
  },
  {
    name: "Telugu",
    code: "te",
  },
  {
    name: "Thai",
    code: "th",
  },
  {
    name: "Tigrinya*",
    code: "ti",
  },
  {
    name: "Tsonga*",
    code: "ts",
  },
  {
    name: "Turkish",
    code: "tr",
  },
  {
    name: "Turkmen",
    code: "tk",
  },
  {
    name: "Twi (Akan)*",
    code: "ak",
  },
  {
    name: "Ukrainian",
    code: "uk",
  },
  {
    name: "Urdu",
    code: "ur",
  },
  {
    name: "Uyghur",
    code: "ug",
  },
  {
    name: "Uzbek",
    code: "uz",
  },
  {
    name: "Vietnamese",
    code: "vi",
  },
  {
    name: "Welsh",
    code: "cy",
  },
  {
    name: "Xhosa",
    code: "xh",
  },
  {
    name: "Yiddish",
    code: "yi",
  },
  {
    name: "Yoruba",
    code: "yo",
  },
  {
    name: "Zulu",
    code: "zu",
  },
];
