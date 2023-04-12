import { HNSWLib } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { DirectoryLoader, TextLoader, PDFLoader, DocxLoader } from "langchain/document_loaders";

export class DataManager {
    text: string;
    vectorStore: HNSWLib;

    async initialize() {

      // Load in the files we want to do question answering over
      const loader = new DirectoryLoader(
        "./documents",
        {
          ".txt": (path) => new TextLoader(path),
          ".pdf": (path) => new PDFLoader(path),
          ".docx": (path) => new DocxLoader(path),
        }
      );

      const rawDocs = await loader.load();

      // Split the text into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
      const docs = await textSplitter.splitDocuments(rawDocs);
      
      // Create the vectorstore
      this.vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
    }
}