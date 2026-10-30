export const projects = [
  {
    title: "Recoverability-Aware World Models",
    description:
      "World-model training objective that preserves whether a vehicle can still recover after a decision, distilled into a DAgger-trained driving policy. Includes a headless CARLA pipeline that mines unrecoverable scenes, with NVIDIA Cosmos counterfactuals.",
    tech: ["PyTorch", "CARLA", "NVIDIA Cosmos", "Imitation Learning"],
    status: "Ongoing",
  },
  {
    title: "Undercurrent",
    description:
      "Foundation-model commodity forecasting: benchmarking Chronos-2 with covariates against a hierarchical Bayesian driver model combined via Bayesian Predictive Synthesis, scored on CRPS and calibration.",
    tech: ["Python", "Chronos-2", "Bayesian Modelling", "Time-Series"],
    status: "Ongoing",
  },
  {
    title: "Talkback",
    description:
      "Reads books aloud with a full expressive cast and lets you talk back to the characters by voice. Each character answers in their own voice using only what you have read so far, so nothing is spoiled. Includes lip-synced faces, voice cloning and a textbook mode.",
    tech: ["React", "FastAPI", "Higgs Audio TTS", "Realtime Voice"],
    link: "https://github.com/fredwang1012/talkback",
    status: "Ongoing",
  },
  {
    title: "text2sql-memory",
    description:
      "Text-to-SQL that retrieves business logic, not just schema: a typed, versioned store of glossary terms, metric definitions, join paths and verified examples. Evaluated against a schema-only baseline on BIRD with the evidence hints hidden.",
    tech: ["Python", "Claude API", "Hybrid Retrieval", "BIRD"],
    link: "https://github.com/fredwang1012/text2sql-memory",
    status: "Ongoing",
  },
  {
    title: "arXiv Paper RAG",
    description:
      "Answers questions about a reading list of arXiv papers with every claim cited to the exact paper and section. Papers are parsed from their LaTeX source, and each cited quote is checked against the passage it came from.",
    tech: ["Python", "Claude API", "BM25 + Embeddings", "FastAPI"],
    link: "https://github.com/fredwang1012/arxiv-paper-rag",
    status: "Ongoing",
  },
  {
    title: "Semantic PDF Reader",
    description:
      "A local PDF reader you search by meaning: ask a question and it jumps to the page and highlights the passage, in one document or across a whole library. Hybrid BM25 + multilingual embedding search; nothing leaves your machine.",
    tech: ["React", "pdf.js", "FastAPI", "PyMuPDF"],
    link: "https://github.com/fredwang1012/semantic-pdf-reader",
    status: "Ongoing",
  },
  {
    title: "Unsupervised Patient Stratification",
    description:
      "VAE/GMVAE + K-Means on structured labs and Chinese free-text exam reports (234K visits, 109K patients). Discovered 7 interpretable clinical phenotypes without labels, including liver fibrosis, hypothyroidism, and sensorineural hearing loss (silhouette 0.267, DBI 1.694).",
    tech: ["PyTorch", "VAE / GMVAE", "K-Means", "TF-IDF + SVD"],
    link: "https://github.com/fredwang1012/patient-stratification",
    image: "/patient-stratification.webp",
    imageFit: "contain",
  },
  {
    title: "GreenLife",
    description:
      "Full-stack web app that personalises Canadian sustainability incentives using AWS Bedrock + RAG (1st place, AWS x UBC CIC Generative-AI Sustainability Hackathon).",
    tech: ["Next.js", "AWS Bedrock", "OpenSearch", "S3"],
    link: "https://github.com/fredwang1012/greenlife",
    image: "/greenlife.webp",
  },
  {
    title: "Great Expectations – SQL Server Integration",
    description:
      "Contributed SQL Server Managed Instance support to the open-source Great Expectations library for Databricks integration.",
    tech: ["Python", "Great Expectations", "SQL Server", "Databricks"],
    link: "https://github.com/fredwang1012/great_expectations/tree/fredwang1012",
    image: "/gx.webp",
  },
  {
    title: "WealthComplex",
    description:
      "Mock investment-management platform that lets users trade, manage funds, and research equities.",
    tech: ["Node.js", "React", "Oracle SQL*Plus"],
    link: "https://github.com/fredwang1012/wealthcomplex",
    image: "/wealthcomplex.webp",
  },
];
