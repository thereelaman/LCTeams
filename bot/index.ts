// Import required packages
import express from "express";

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
//import { CloudAdapter, ConfigurationBotFrameworkAuthentication, ConfigurationServiceClientCredentialFactory } from "botbuilder";
import { BotFrameworkAdapter } from "botbuilder";
import { TurnContext } from "botbuilder";

import { TeamsBot } from "./teamsBot";
import { DataManager } from "./dataManager";
import config from "./config";

/*
console.log("creating adapter");

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: config.botId,
  MicrosoftAppPassword: config.botPassword,
  MicrosoftAppType: "MultiTenant",
});

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
  {},
  credentialsFactory
);

const adapter = new CloudAdapter(botFrameworkAuthentication);*/
const adapter = new BotFrameworkAdapter({
  appId: config.botId,
  appPassword: config.botPassword,
});


// Catch-all for errors.
const onTurnErrorHandler = async (context: TurnContext, error: Error) => {
  // This check writes out errors to console log .vs. app insights.
  // NOTE: In production environment, you should consider logging this to Azure
  //       application insights.
  console.error(`\n [onTurnError] unhandled error: ${error}`);

  // Send a trace activity, which will be displayed in Bot Framework Emulator
  await context.sendTraceActivity(
    "OnTurnError Trace",
    `${error}`,
    "https://www.botframework.com/schemas/error",
    "TurnError"
  );

  // Send a message to the user
  await context.sendActivity(`The bot encountered unhandled error:\n ${error.message}`);
  await context.sendActivity("To continue to run this bot, please fix the bot source code.");
};

// Set the onTurnError for the singleton BotFrameworkAdapter.
adapter.onTurnError = onTurnErrorHandler;

//Create the data
let chatHistory = "";
let bot : TeamsBot;
const dataManager = new DataManager();
dataManager.initialize().then(() => {
  // Create the bot that will handle incoming messages.
  bot = new TeamsBot(chatHistory, dataManager.vectorStore);
});

// Create HTTP server.
const server = express();
server.listen(process.env.port || process.env.PORT || 3978, () => {
  console.log(`\nBot Started, express server is runnning.`);
});

// Listen for incoming requests.
server.post("/api/messages", async (req, res) => {
  await adapter.processActivity(req, res, async (context) => {
    await bot.run(context);
  });
});
