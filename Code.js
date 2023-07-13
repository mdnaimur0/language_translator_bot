const BOT_TOKEN = PropertiesService.getScriptProperties().getProperty('botToken');
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/`;
const BMC_URL = 'https://www.buymeacoffee.com/mdnaimur';
const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwxgW8ur_JH19DdjKA96aBN0r74JkYEkiWvXfOA9rDvk0rg-GS6AKPNxT_e8w0Z37Xs4w/exec';

const userSheet = SpreadsheetApp.openById("1C7cNMlG468pAqN9pYllYR15ZjCR0rJi3Jh42R7lD670").getSheetByName("Users");

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
  var reply = "Invalid command!";
  var command = update.message.text;
  var chatId = update.message.from.id;
  if (command == "/start")
    return replyToSender(chatId, "Hello there, how can I help you?");
  if (command == "/set") {
    return sendLanguageList(1, chatId);
  }
  if (command == "/list") {
    var text = '';
    languages.forEach((lang) => {
      text = text + '\n' + lang.code + ' -> ' + lang.name;
    });
    return replyToSender(chatId, `All supported languages are listed here:\n_Language Code -> Language name_\n ${text}`);
  }
  if (command == "/remove") {
    resetDefaultLanguage(chatId);
    return replyToSender(chatId, "Custom language removed and translation language is reset to English (en)");
  }
  if (command == "/help") {
    var text = `Hi ${update.message.from.first_name},\n\nYou can send me any text that you want to translate. Please follow the following format.\n\n\`text to translate | language-code\`\n\nExample: \`Hello there | bn\`\n\nUse /list to know language codes.\n\n_If you do not specify any language code, the given text will be translated to English or the default language you have set using_ /set.`
    return replyToSender(chatId, text);
  }
  return replyToMessage(chatId, reply, update.message.message_id);
}

function handleNonCommand(query) {
  var message = query.message;
  var msgId = message.message_id;
  var chatId = message.from.id;
  var text = message.text;
  if (text) {
    var textToTranslate = text;
    var toLang = '';
    if (text.includes('|')) {
      var split = text.split("|");
      textToTranslate = split[0].trim();
      toLang = split[1].trim();
    } else {
      toLang = getDefaultLanguage(chatId);
    }
    if (textToTranslate.trim() === "") {
      return replyToMessage(chatId, "No text to translate!", msgId);
    }
    try {
      var res = LanguageApp.translate(textToTranslate, '', toLang);
      if (res) {
        return replyToMessage(chatId, res, msgId);
      }
    }
    catch (error) {
      Logger.log(error);
    }
    return replyToMessage(chatId, "Sorry! I couldn't translate your text.", msgId);
  }
  return replyToMessage(chatId, "Unsupported message format!", msgId);
}

function handleCallbackQuery(query) {
  var chatId = query.from.id;
  var msgId = query.message.message_id;
  var name = query.from.first_name + ((query.from.last_name) ? " " + query.from.last_name : "");
  var data = query.data;
  if (data.startsWith("/set")) {
    var langCode = data.substr(5);
    var offset = parseInt(langCode);
    if (offset) {
      return sendLanguageList(offset, chatId, msgId);
    }
    saveDefaultLanguage(
      chatId,
      name,
      langCode
    );
    var langName = "";
    for (var i = 0; i < languages.length; i++) {
      if (languages[i].code == langCode) {
        langName = languages[i].name;
        break;
      }
    }
    return editBotMessage(chatId, msgId, `Successfully set the language to ${langName} (${langCode})`);
  }
}

function sendLanguageList(offset, chatId, msgId) {
  var buttons = [];
  var row = [];
  var defaultLang = getDefaultLanguage(chatId);
  getLanguageList(offset).forEach((lang) => {
    var btn = {
      "text": lang.code == defaultLang ? "✅ " + lang.name : lang.name,
      'callback_data': '/set ' + lang.code
    };
    if (row.length < 3) {
      row.push(btn);
    } else {
      buttons.push(row);
      row = [];
      if (buttons.length == 6) {
        if (offset == 1) {
          buttons.push([
            {
              "text": '->',
              'callback_data': `/set ${offset + 1}`
            }
          ]);
        } else if (offset == Math.ceil(languages.length / 24)) {
          buttons.push([
            {
              "text": '<-',
              'callback_data': `/set ${offset - 1}`
            }
          ]);
        } else {
          buttons.push([
            {
              "text": '<-',
              'callback_data': `/set ${offset - 1}`
            },
            {
              "text": '->',
              'callback_data': `/set ${offset + 1}`
            }
          ]);
        }
      }
    }
  });
  if (offset == 1)
    return replyToSender(chatId, "Select deafult language for text to be translated to:", { 'inline_keyboard': buttons });
  else
    return editBotMessage(chatId, msgId, "Select deafult language for text to be translated to:", { 'inline_keyboard': buttons });
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
    userSheet.getRange(index + 1, 3).setValue('en');
  }
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

// Telegram related methods

function editBotMessage(chatId, message_id, message, reply_markup = null) {
  return requestTelegramAPI('editMessageText', {
    'chat_id': chatId,
    'text': message,
    'message_id': message_id,
    'parse_mode': 'markdown',
    'reply_markup': reply_markup == null ? '{}' : JSON.stringify(reply_markup)
  });
}

function replyToMessage(chatId, text, reply_to_message_id) {
  return requestTelegramAPI('sendMessage', {
    'chat_id': chatId,
    'text': text,
    reply_to_message_id,
    'parse_mode': 'markdown'
  });
}

function replyToSender(chatId, text, reply_markup = null) {
  return requestTelegramAPI('sendMessage', {
    'chat_id': chatId,
    'text': text,
    'parse_mode': 'markdown',
    'reply_markup': reply_markup == null ? '{}' : JSON.stringify(reply_markup)
  });
}

function requestTelegramAPI(method, data) {
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(data),
    'muteHttpExceptions': true
  };
  try {
    return JSON.parse(UrlFetchApp.fetch(API_URL + method, options));
  } catch (error) {
    Logger.log(error);
  }
}

function telegramError() {
  var result = requestTelegramAPI('getWebhookInfo', {});
  Logger.log(result);
}

function deleteWebhook() {
  var result = requestTelegramAPI('deleteWebhook', {
    drop_pending_updates: true
  });
  Logger.log(result);
}

function setWebhook() {
  var result = requestTelegramAPI('setWebhook', {
    url: WEBHOOK_URL,
  });
  Logger.log(result);
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
  var name = chat.first_name + ((chat.last_name) ? " " + chat.last_name : "");
  var username = chat.username;
  var message = update.message.text;
  sheet.appendRow([date, chatId, name, username, message]);
}

// Values

const languages = [
  {
    "name": "Afrikaans",
    "code": "af"
  },
  {
    "name": "Albanian",
    "code": "sq"
  },
  {
    "name": "Amharic",
    "code": "am"
  },
  {
    "name": "Arabic",
    "code": "ar"
  },
  {
    "name": "Armenian",
    "code": "hy"
  },
  {
    "name": "Assamese*",
    "code": "as"
  },
  {
    "name": "Aymara*",
    "code": "ay"
  },
  {
    "name": "Azerbaijani",
    "code": "az"
  },
  {
    "name": "Bambara*",
    "code": "bm"
  },
  {
    "name": "Basque",
    "code": "eu"
  },
  {
    "name": "Belarusian",
    "code": "be"
  },
  {
    "name": "Bengali",
    "code": "bn"
  },
  {
    "name": "Bhojpuri*",
    "code": "bho"
  },
  {
    "name": "Bosnian",
    "code": "bs"
  },
  {
    "name": "Bulgarian",
    "code": "bg"
  },
  {
    "name": "Catalan",
    "code": "ca"
  },
  {
    "name": "Cebuano",
    "code": "ceb"
  },
  {
    "name": "Chinese (Simplified)",
    "code": "zh-CN"
  },
  {
    "name": "Chinese (Traditional)",
    "code": "zh-TW"
  },
  {
    "name": "Corsican",
    "code": "co"
  },
  {
    "name": "Croatian",
    "code": "hr"
  },
  {
    "name": "Czech",
    "code": "cs"
  },
  {
    "name": "Danish",
    "code": "da"
  },
  {
    "name": "Dhivehi*",
    "code": "dv"
  },
  {
    "name": "Dogri*",
    "code": "doi"
  },
  {
    "name": "Dutch",
    "code": "nl"
  },
  {
    "name": "English",
    "code": "en"
  },
  {
    "name": "Esperanto",
    "code": "eo"
  },
  {
    "name": "Estonian",
    "code": "et"
  },
  {
    "name": "Ewe*",
    "code": "ee"
  },
  {
    "name": "Filipino (Tagalog)",
    "code": "fil"
  },
  {
    "name": "Finnish",
    "code": "fi"
  },
  {
    "name": "French",
    "code": "fr"
  },
  {
    "name": "Frisian",
    "code": "fy"
  },
  {
    "name": "Galician",
    "code": "gl"
  },
  {
    "name": "Georgian",
    "code": "ka"
  },
  {
    "name": "German",
    "code": "de"
  },
  {
    "name": "Greek",
    "code": "el"
  },
  {
    "name": "Guarani*",
    "code": "gn"
  },
  {
    "name": "Gujarati",
    "code": "gu"
  },
  {
    "name": "Haitian Creole",
    "code": "ht"
  },
  {
    "name": "Hausa",
    "code": "ha"
  },
  {
    "name": "Hawaiian",
    "code": "haw"
  },
  {
    "name": "Hebrew",
    "code": "he"
  },
  {
    "name": "Hindi",
    "code": "hi"
  },
  {
    "name": "Hmong",
    "code": "hmn"
  },
  {
    "name": "Hungarian",
    "code": "hu"
  },
  {
    "name": "Icelandic",
    "code": "is"
  },
  {
    "name": "Igbo",
    "code": "ig"
  },
  {
    "name": "Ilocano*",
    "code": "ilo"
  },
  {
    "name": "Indonesian",
    "code": "id"
  },
  {
    "name": "Irish",
    "code": "ga"
  },
  {
    "name": "Italian",
    "code": "it"
  },
  {
    "name": "Japanese",
    "code": "ja"
  },
  {
    "name": "Javanese",
    "code": "jv"
  },
  {
    "name": "Kannada",
    "code": "kn"
  },
  {
    "name": "Kazakh",
    "code": "kk"
  },
  {
    "name": "Khmer",
    "code": "km"
  },
  {
    "name": "Kinyarwanda",
    "code": "rw"
  },
  {
    "name": "Konkani*",
    "code": "gom"
  },
  {
    "name": "Korean",
    "code": "ko"
  },
  {
    "name": "Krio*",
    "code": "kri"
  },
  {
    "name": "Kurdish",
    "code": "ku"
  },
  {
    "name": "Kurdish (Sorani)*",
    "code": "ckb"
  },
  {
    "name": "Kyrgyz",
    "code": "ky"
  },
  {
    "name": "Lao",
    "code": "lo"
  },
  {
    "name": "Latin",
    "code": "la"
  },
  {
    "name": "Latvian",
    "code": "lv"
  },
  {
    "name": "Lingala*",
    "code": "ln"
  },
  {
    "name": "Lithuanian",
    "code": "lt"
  },
  {
    "name": "Luganda*",
    "code": "lg"
  },
  {
    "name": "Luxembourgish",
    "code": "lb"
  },
  {
    "name": "Macedonian",
    "code": "mk"
  },
  {
    "name": "Maithili*",
    "code": "mai"
  },
  {
    "name": "Malagasy",
    "code": "mg"
  },
  {
    "name": "Malay",
    "code": "ms"
  },
  {
    "name": "Malayalam",
    "code": "ml"
  },
  {
    "name": "Maltese",
    "code": "mt"
  },
  {
    "name": "Maori",
    "code": "mi"
  },
  {
    "name": "Marathi",
    "code": "mr"
  },
  {
    "name": "Meiteilon (Manipuri)*",
    "code": "mni-Mtei"
  },
  {
    "name": "Mizo*",
    "code": "lus"
  },
  {
    "name": "Mongolian",
    "code": "mn"
  },
  {
    "name": "Myanmar (Burmese)",
    "code": "my"
  },
  {
    "name": "Nepali",
    "code": "ne"
  },
  {
    "name": "Norwegian",
    "code": "no"
  },
  {
    "name": "Nyanja (Chichewa)",
    "code": "ny"
  },
  {
    "name": "Odia (Oriya)",
    "code": "or"
  },
  {
    "name": "Oromo*",
    "code": "om"
  },
  {
    "name": "Pashto",
    "code": "ps"
  },
  {
    "name": "Persian",
    "code": "fa"
  },
  {
    "name": "Polish",
    "code": "pl"
  },
  {
    "name": "Portuguese (Portugal, Brazil)",
    "code": "pt"
  },
  {
    "name": "Punjabi",
    "code": "pa"
  },
  {
    "name": "Quechua*",
    "code": "qu"
  },
  {
    "name": "Romanian",
    "code": "ro"
  },
  {
    "name": "Russian",
    "code": "ru"
  },
  {
    "name": "Samoan",
    "code": "sm"
  },
  {
    "name": "Sanskrit*",
    "code": "sa"
  },
  {
    "name": "Scots Gaelic",
    "code": "gd"
  },
  {
    "name": "Sepedi*",
    "code": "nso"
  },
  {
    "name": "Serbian",
    "code": "sr"
  },
  {
    "name": "Sesotho",
    "code": "st"
  },
  {
    "name": "Shona",
    "code": "sn"
  },
  {
    "name": "Sindhi",
    "code": "sd"
  },
  {
    "name": "Sinhala (Sinhalese)",
    "code": "si"
  },
  {
    "name": "Slovak",
    "code": "sk"
  },
  {
    "name": "Slovenian",
    "code": "sl"
  },
  {
    "name": "Somali",
    "code": "so"
  },
  {
    "name": "Spanish",
    "code": "es"
  },
  {
    "name": "Sundanese",
    "code": "su"
  },
  {
    "name": "Swahili",
    "code": "sw"
  },
  {
    "name": "Swedish",
    "code": "sv"
  },
  {
    "name": "Tagalog (Filipino)",
    "code": "tl"
  },
  {
    "name": "Tajik",
    "code": "tg"
  },
  {
    "name": "Tamil",
    "code": "ta"
  },
  {
    "name": "Tatar",
    "code": "tt"
  },
  {
    "name": "Telugu",
    "code": "te"
  },
  {
    "name": "Thai",
    "code": "th"
  },
  {
    "name": "Tigrinya*",
    "code": "ti"
  },
  {
    "name": "Tsonga*",
    "code": "ts"
  },
  {
    "name": "Turkish",
    "code": "tr"
  },
  {
    "name": "Turkmen",
    "code": "tk"
  },
  {
    "name": "Twi (Akan)*",
    "code": "ak"
  },
  {
    "name": "Ukrainian",
    "code": "uk"
  },
  {
    "name": "Urdu",
    "code": "ur"
  },
  {
    "name": "Uyghur",
    "code": "ug"
  },
  {
    "name": "Uzbek",
    "code": "uz"
  },
  {
    "name": "Vietnamese",
    "code": "vi"
  },
  {
    "name": "Welsh",
    "code": "cy"
  },
  {
    "name": "Xhosa",
    "code": "xh"
  },
  {
    "name": "Yiddish",
    "code": "yi"
  },
  {
    "name": "Yoruba",
    "code": "yo"
  },
  {
    "name": "Zulu",
    "code": "zu"
  }
];