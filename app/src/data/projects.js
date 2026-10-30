export const projects = [
  {
    title: "Recoverability-Aware World Models",
    description:
      "World-model training objective that preserves whether a vehicle can still recover after a decision, distilled into a DAgger-trained driving policy. Includes a headless CARLA pipeline that mines unrecoverable scenes, with NVIDIA Cosmos counterfactuals (in progress).",
    tech: ["PyTorch", "CARLA", "NVIDIA Cosmos", "Imitation Learning"],
  },
  {
    title: "Undercurrent",
    description:
      "Foundation-model commodity forecasting: benchmarking Chronos-2 with covariates against a hierarchical Bayesian driver model combined via Bayesian Predictive Synthesis, scored on CRPS and calibration (in progress).",
    tech: ["Python", "Chronos-2", "Bayesian Modelling", "Time-Series"],
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
