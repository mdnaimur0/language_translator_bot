const BOT_TOKEN =
  PropertiesService.getScriptProperties().getProperty("botToken");
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/`;
const BMC_URL = "https://www.buymeacoffee.com/mdnaimur";
const DEV_CHAT_ID = "1493956826";
const userSheet = SpreadsheetApp.openById(
  "YOUR_SHEET_ID"
).getSheetByName("Users");

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
  var chatId = update.message.chat.id;
  if (command == "/start") {
    bot.sendMessage({
      chat_id: chatId,
      text: "Hello there! I'm your personal language translator. From any language to any other, I'm here to facilitate your linguistic journey. \n\nTo know how to translate, use /help.",
    });t
    addOrUpdateUser(
      chatId,
      update.message.from.first_name,
      update.message.from.last_name
    );
  } else if (command == "/set") {
    bot.sendMessage({
      chat_id: chatId,
      text: "Select default language for text to be translated to:",
      reply_markup: getLanguageButtonsMarkup(1, chatId),
    });
  } else if (command == "/list") {
    sendTyping(chatId);
    var text = "";
    languages.forEach((lang) => {
      text = text + "\n<code>" + lang.code + "</code> --> " + lang.name;
    });
    bot.sendMessage({
      chat_id: chatId,
      text: `List of supported languages:\n ${text}`,
      parse_mode: "html",
    });
  } else if (command == "/remove") {
    resetDefaultLanguage(chatId);
    bot.sendMessage({
      chat_id: chatId,
      text: "Default translation language reset to English (en)",
    });
  } else if (command == "/help") {
    sendTyping(chatId);
    var text =
      `Hi ${update.message.from.first_name},\n\n` +
      "Simply send me any text you'd like to translate in the following format:\n\n`text-to-translate | language-code`\n\nFor example: `Hello there | bn`\n\nTo view language codes, use the command /list.\n\n_If no language code is specified, the text will be translated to English or your default language set with_ /set.";
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
  var chatId = message.chat.id;
  var text = message.text;
  var response = "Sorry! I couldn't translate your text. 😔";
  var reply_markup = "";
  if (text) {
    var textToTranslate = text;
    var toLang = "";
    var index = text.lastIndexOf("|");
    if (index > 0) {
      textToTranslate = text.substring(0, index).trim();
      toLang = text.substring(index + 1).trim();
    } else {
      toLang = getDefaultLanguage(chatId);
    }
    if (textToTranslate.trim() == "") {
      response = "No text to translate!";
    } else {
      try {
        response = LanguageApp.translate(textToTranslate, "", toLang);
        reply_markup = {
          inline_keyboard: [[{ text: "💰 Donate", callback_data: "/donate" }]],
        };
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
    reply_markup: reply_markup,
  });
}

function handleCallbackQuery(query) {
  var from = query.from;
  var chatId = query.message.chat.id;
  var msgId = query.message.message_id;
  var queryId = query.callback_query_id;
  var data = query.data;
  if (data.startsWith("/set")) {
    var langCode = data.substring(5);
    var offset = parseInt(langCode);
    if (offset) {
      bot.editMessageReplyMarkup({
        chat_id: chatId,
        message_id: msgId,
        reply_markup: getLanguageButtonsMarkup(offset, chatId),
      });
      return;
    }
    addOrUpdateUser(chatId, from.first_name, from.last_name, langCode);
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
      text: `Default translation language set to ${langName} (${langCode}) successfully.`,
    });
  } else if (data.startsWith("/donate")) {
    if (data.trim() == "/donate") {
      var text = `Hello there,\n\nIf you find this translation service helpful, you can support me in keeping it free and available. Your contribution helps ensure the continued operation and improvement of this service.\n\nIf you are in Bangladesh, you can donate me through *bKash* or *Nagad*. Otherwise, you can [buy me a coffee](${BMC_URL}).`;
      var buttons = [
        [
          { text: "bKash", callback_data: "/donate bkash" },
          { text: "Nagad", callback_data: "/donate nagad" },
        ],
        [{ text: "Buy me a coffee", url: BMC_URL }],
      ];
      bot.sendMessage({
        chat_id: chatId,
        text: text,
        parse_mode: "markdown",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: buttons },
      });
      bot.answerCallbackQuery({ callback_query_id: queryId });
    } else if (data.includes("bkash")) {
      bot.editMessageText({
        chat_id: chatId,
        message_id: msgId,
        text: "If you're willing to donate through bKash, you can scan the [QR code](https://github.com/naimur20/naimur20.github.io/raw/main/bKash.png) to send money or you can manually do *Send Money* to this personal bKash account: `01940289890`\n\n*N.B:* _Please don't call the number._\n\nThanks for your support.",
        parse_mode: "markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Donate through Nagad", callback_data: "/donate nagad" }],
          ],
        },
      });
    } else if (data.includes("nagad")) {
      bot.editMessageText({
        chat_id: chatId,
        message_id: msgId,
        text: "If you're willing to donate through Nagad, you can do *Send Money* to this personal Nagad account: `01940289890`\n\n*N.B:* _Please don't call the number._\n\nThanks for your support.",
        parse_mode: "markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Donate through bKash", callback_data: "/donate bkash" }],
          ],
        },
      });
    }
  }
}

function sendTyping(chatId) {
  bot.sendChatAction({ chat_id: chatId, action: "typing" });
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
    row.push({ text: "⬅️", callback_data: `/set ${offset - 1}` });
  }
  if (offset < Math.ceil(languages.length / 24)) {
    row.push({ text: "➡️", callback_data: `/set ${offset + 1}` });
  }
  buttons.push(row);
  return { inline_keyboard: buttons };
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

// sheet related methods

function addOrUpdateUser(chatId, fname, lname, language) {
  var name = fname + (lname ? " " + lname : "");
  var chatIdColumn = userSheet.getRange("A:A").getValues().flat();
  var index = chatIdColumn.indexOf(chatId);
  if (index > -1) {
    userSheet.getRange(index + 1, 2).setValue(name);
    if (language != undefined) {
      userSheet.getRange(index + 1, 3).setValue(language);
    }
  } else {
    userSheet.appendRow([chatId, name, language]);
  }
}

function getDefaultLanguage(chatId) {
  var chatIdColumn = userSheet.getRange("A:A").getValues().flat();
  var defaultLanguageColumn = userSheet.getRange("C:C").getValues().flat();
  var index = chatIdColumn.indexOf(chatId);
  if (index > -1) {
    var lang = defaultLanguageColumn[index];
    if (lang.toString().trim() == "") return "en";
    else return lang;
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