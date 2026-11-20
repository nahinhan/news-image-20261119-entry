# News Image Bounty: 19 November 2026 in One Image

[![Make.Fun Bounty](https://make.fun/badge/news-image-20261119.svg)](https://make.fun/c/news-image-20261119)
[![Rank](https://make.fun/badge/news-image-20261119/nahinhan/news-image-bounty/rank.svg)](https://make.fun/c/news-image-20261119)
[![Reward](https://make.fun/badge/news-image-20261119/nahinhan/news-image-bounty/reward.svg)](https://make.fun/c/news-image-20261119)

A deterministic Node.js application that synthesizes world news for Thursday, 19 November 2026 into a clean, structured, high-impact front-page infographic (`entry.png`).

## Overview

This repository contains the solution for the [make.fun](https://make.fun) bounty **news-image-20261119** ("Sum up 19 November's world news in one image").

- **Runtime**: Node.js 22 (Standard Library only)
- **Output**: 1024x1024 PNG image rendered deterministically via pure Node.js graphics and Zlib compression.
- **Author**: `@nahinhan`

## Running Locally

```bash
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT License - see [LICENSE](LICENSE) for details.
