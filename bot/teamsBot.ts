// Teams Bot Imports
import {
  TeamsActivityHandler,
  CardFactory,
  TurnContext,
  AdaptiveCardInvokeValue,
  AdaptiveCardInvokeResponse,
} from "botbuilder";
import rawWelcomeCard from "./adaptiveCards/welcome.json";
import { AdaptiveCards } from "@microsoft/adaptivecards-tools";

import config from "./config";

//LangChain Imports
import { OpenAIChat } from "langchain/llms";
import { LLMChain, ChatVectorDBQAChain, loadQAChain } from "langchain/chains";
import { HNSWLib } from "langchain/vectorstores";
import { PromptTemplate } from 'langchain/prompts';

const CONDENSE_PROMPT = PromptTemplate.fromTemplate(
`Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.
Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`);

const QA_PROMPT = PromptTemplate.fromTemplate(
`You are an AI assistant providing helpful advice. You are given the following extracted parts of a long document and a question. Provide a conversational answer based on the context provided.
You should only provide hyperlinks that reference the context below. Do NOT make up hyperlinks.
If you can't find the answer in the context below, just say "Hmm, I'm not sure." Don't try to make up an answer.
If the question is not related to the context, politely respond that you are tuned to only answer questions that are related to the context.
Question: {question}
=========
{context}
=========
Answer:`,
);

export class TeamsBot extends TeamsActivityHandler {
  chatHistory: string;
  vectorStore: HNSWLib;

  constructor(chatHistoryInit: string, vectorStoreInit: HNSWLib) {
    super();

      this.chatHistory = chatHistoryInit;
      this.vectorStore = vectorStoreInit;

      // Initialize the LLM to use to answer the question 
      const questionGenerator = new LLMChain({
        llm: new OpenAIChat({ temperature: 0, openAIApiKey: config.openaiApiKey }), //temperature means creativity from 0 to 1
        prompt: CONDENSE_PROMPT,
      });

      const docChain = loadQAChain(
        new OpenAIChat({
          temperature: 0,
          modelName: 'gpt-3.5-turbo', //change this to older versions (e.g. gpt-3.5-turbo) if you don't have access to gpt-4
          openAIApiKey: config.openaiApiKey,
        }),
        { prompt: QA_PROMPT },
      );

      const chain = new ChatVectorDBQAChain({
        vectorstore:this.vectorStore,
        combineDocumentsChain: docChain,
        questionGeneratorChain: questionGenerator,
        returnSourceDocuments: true,
        k: 2, //number of source documents to return
      });

    this.onMessage(async (context, next) => {

      //Get the user input
      let txt = context.activity.text;

      const removedMentionText = TurnContext.removeRecipientMention(context.activity);
      if (removedMentionText) {
        // Remove the line break
        txt = removedMentionText.toLowerCase().replace(/\n|\r/g, "").trim();
      }
  
      console.log(txt);

      const res = await chain.call({ question:txt, chat_history: this.chatHistory});

      console.log(res);
      this.chatHistory = this.chatHistory + txt + res.text;

      await context.sendActivity(res);

      // By calling next() you ensure that the next BotHandler is run.
      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (let cnt = 0; cnt < membersAdded.length; cnt++) {
        if (membersAdded[cnt].id) {
          const card = AdaptiveCards.declareWithoutData(rawWelcomeCard).render();
          await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
          break;
        }
      }
      await next();
    });
  }
}
