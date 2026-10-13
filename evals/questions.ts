import { z } from "zod";

export const evalQuestionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    question: z.string().min(1),
    lang: z.enum(["en", "no"]),
    category: z.enum(["lookup", "comparison", "change", "out-of-scope", "no-data"]),
    // Any of these tables is a correct pick; more than one table can answer some questions.
    tables: z.array(z.string().regex(/^\d{5}$/)),
    // The agent should decline or say the data doesn't exist, instead of answering.
    refusal: z.boolean(),
  })
  .refine((q) => q.refusal || q.tables.length > 0, {
    message: "Answerable questions need at least one expected table",
  });

export type EvalQuestion = z.infer<typeof evalQuestionSchema>;

export const questions: EvalQuestion[] = [
  {
    id: "oslo-population",
    question: "How many people live in Oslo?",
    lang: "en",
    category: "lookup",
    tables: ["07459"],
    refusal: false,
  },
  {
    id: "cpi-latest",
    question: "What is the latest consumer price index for Norway?",
    lang: "en",
    category: "lookup",
    tables: ["14710"],
    refusal: false,
  },
  {
    id: "unemployment-rate",
    question: "What is the unemployment rate in Norway right now?",
    lang: "en",
    category: "lookup",
    tables: ["13760", "14483"],
    refusal: false,
  },
  {
    id: "births-last-year",
    question: "How many children were born in Norway last year?",
    lang: "en",
    category: "lookup",
    tables: ["05531", "06990", "05523", "08450"],
    refusal: false,
  },
  {
    id: "bergen-vs-trondheim",
    question: "Which has more inhabitants, Bergen or Trondheim?",
    lang: "en",
    category: "comparison",
    tables: ["07459"],
    refusal: false,
  },
  {
    id: "earnings-by-sex",
    question: "How do average monthly earnings compare between men and women?",
    lang: "en",
    category: "comparison",
    tables: ["12521", "13860"],
    refusal: false,
  },
  {
    id: "dwelling-prices-change",
    question: "How much have prices for existing dwellings changed over the last year?",
    lang: "en",
    category: "change",
    tables: ["07221", "07230"],
    refusal: false,
  },
  {
    id: "dodsfall-no",
    question: "Hvor mange døde i Norge i fjor?",
    lang: "no",
    category: "lookup",
    tables: ["08393", "05379"],
    refusal: false,
  },
  {
    id: "weather-out-of-scope",
    question: "What will the weather be like in Tromsø tomorrow?",
    lang: "en",
    category: "out-of-scope",
    tables: [],
    refusal: true,
  },
  {
    id: "unemployment-2031-no-data",
    question: "Hva var arbeidsledigheten i Norge i mars 2031?",
    lang: "no",
    category: "no-data",
    tables: [],
    refusal: true,
  },
];
