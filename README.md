# Import on type extension

Import on type automatically add imports you configured if they are missing while you type, accept code from ai suggested code or trigger snippets.

> [!WARNING]
> This extension supports only typescript/javascript files for now. Contributions are welcome to add support for other languages.

## Configuration

```jsonc
{
  "importOnType.imports": [
    {
      "variableOrFn": "memo",
      "path": "react",
      // will add a named import:
      // import { memo } from 'react'
    },
    {
      "variableOrFn": "FC",
      "path": "react",
      "isTypeImport": true,
      // will add a named type import:
      // import type { FC } from 'react'
    },
    {
      "variableOrFn": "React",
      "path": "react",
      "isDefaultImport": true,
      // will add a default import:
      // import React from 'react'
    },
    {
      "variableOrFn": "fs",
      "path": "fs",
      "isNamespaceImport": true,
      // will add a namespace import:
      // import * as fs from 'fs'
    },
  ],

  // If true, will trigger organize imports after adding an import
  "importOnType.triggerOrganizeImports": true,
}
```
