# Import on type extension

Import on type automatically add imports you configured if they are missing while you type, accept code from ai suggested code or trigger snippets.

> [!WARNING]
> This extension supports only typescript/javascript files for now. Contributions are welcome to add support for other languages.

## Configuration

```jsonc
{
  "importOnType.imports": [
    {
      "path": "react",
      "namedImports": ["memo", "useState", "useEffect"],
      // will add named imports:
      // import { memo } from 'react'
      // import { useState } from 'react'
      // import { useEffect } from 'react'
    },
    {
      "path": "react",
      "typeImports": ["FC", "ReactNode"],
      // will add type imports:
      // import type { FC } from 'react'
      // import type { ReactNode } from 'react'
    },
    {
      "path": "react",
      "defaultImports": ["React"],
      // will add default imports:
      // import React from 'react'
    },
    {
      "path": "fs",
      "namespaceImports": ["fs"],
      // will add namespace imports:
      // import * as fs from 'fs'
    },
    {
      // You can mix different types of imports from the same path
      "path": "@/utils",
      "namedImports": ["formatDate", "formatNumber"],
      "typeImports": ["DateFormat"],
      "defaultImports": ["Utils"],
    },
  ],

  // If true, will trigger organize imports after adding an import
  "importOnType.triggerOrganizeImports": true,
}
```
