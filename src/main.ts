import { EnhancedMap } from '@ls-stack/utils/enhancedMap'
import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
  type ImportCfg = {
    path: string
    typeImports?: string[]
    defaultImports?: string[]
    namespaceImports?: string[]
    namedImports?: string[]
  }

  const regexCache = new EnhancedMap<string, RegExp>()

  const config: {
    imports: ImportCfg[]
    triggerOrganizeImports: boolean
  } = {
    imports: [],
    triggerOrganizeImports: true,
  }

  function updateConfig() {
    config.imports =
      vscode.workspace.getConfiguration('importOnType').get<ImportCfg[]>('imports') ?? []

    config.triggerOrganizeImports =
      vscode.workspace
        .getConfiguration('importOnType')
        .get<boolean>('triggerOrganizeImports') ?? true
  }

  updateConfig()

  let undoSubscription: vscode.Disposable | undefined
  const skipNextAddImport = new Set<string>()
  let disposeUndoSubscriptionTimeout: NodeJS.Timeout | undefined
  let enableAddImportTimeout: NodeJS.Timeout | undefined

  const outputChannel = vscode.window.createOutputChannel('Import on type')

  function logToOutputChannel(message: string) {
    outputChannel.appendLine(message)
    console.info(message)
  }

  async function addImportToDocument(
    document: vscode.TextDocument,
    importPath: string,
    matchedImport: string,
    importType: 'type' | 'default' | 'namespace' | 'named',
  ) {
    if (skipNextAddImport.has(matchedImport)) {
      logToOutputChannel(`Skipping add import for ${matchedImport}`)
      return
    }

    const edit = new vscode.WorkspaceEdit()

    // Find all import statements in the document
    const fullText = document.getText()
    const importEndRegex = /import [\s\S]+?\s+from\s+['"](.*)['"][ ;]*\n/g
    let lastImportMatch: RegExpExecArray | null = null
    let match: RegExpExecArray | null

    while ((match = importEndRegex.exec(fullText)) !== null) {
      lastImportMatch = match
    }

    // Calculate the position to insert the new import
    const position =
      lastImportMatch ?
        document.positionAt(lastImportMatch.index + lastImportMatch[0].length)
      : new vscode.Position(0, 0)

    // Generate import statement based on configuration
    let importSpecifier: string
    switch (importType) {
      case 'type': {
        const alreadyImportsPathRegex = regexCache.getOrInsert(
          importPath,
          () => new RegExp(String.raw`from\s+['"]${importPath}['"]`),
        )

        if (alreadyImportsPathRegex.test(fullText)) {
          importSpecifier = `{ type ${matchedImport} } `
        } else {
          importSpecifier = `type { ${matchedImport} }`
        }
        break
      }

      case 'namespace':
        importSpecifier = `* as ${matchedImport}`
        break
      case 'default':
        importSpecifier = matchedImport
        break
      default:
        importSpecifier = `{ ${matchedImport} }`
        break
    }
    const importStatement = `import ${importSpecifier} from '${importPath}';`

    const textToInsert = `${importStatement}\n`

    if (fullText.includes(importStatement)) {
      return
    }

    edit.insert(document.uri, position, textToInsert)

    await vscode.workspace.applyEdit(edit)

    if (config.triggerOrganizeImports) {
      vscode.commands.executeCommand('editor.action.organizeImports')
    }

    undoSubscription?.dispose()

    undoSubscription = vscode.commands.registerCommand('undo', () => {
      skipNextAddImport.add(matchedImport)

      logToOutputChannel(`Disabling add import for 5 seconds for ${matchedImport}`)

      enableAddImportTimeout = setTimeout(() => {
        skipNextAddImport.delete(matchedImport)

        logToOutputChannel(`Add import is enabled again for ${matchedImport}`)
      }, 5000)

      undoSubscription?.dispose()
      vscode.commands.executeCommand('default:undo')
    })

    disposeUndoSubscriptionTimeout = setTimeout(() => {
      undoSubscription?.dispose()
    }, 60_000)
  }

  function checkLintErrorsInDocument(document: vscode.TextDocument) {
    const diagnostics = vscode.languages.getDiagnostics(document.uri)

    const tsSyntacticErrors = diagnostics.filter((diagnostic) => {
      if (diagnostic.source !== 'ts') return false

      const diagnosticCode = typeof diagnostic.code === 'number' ? diagnostic.code : 0

      // Ignore verbatimModuleSyntax errors
      if (diagnosticCode === 1484) return false

      return diagnosticCode < 2000
    })

    const tsUndefinedVariableErrors = diagnostics.filter(
      (diagnostic) =>
        diagnostic.source === 'ts' &&
        (diagnostic.code === 2304 ||
          diagnostic.code === 2582 ||
          diagnostic.code === 2552),
    )

    const addedImports = new Set<string>()

    for (const diagnostic of tsUndefinedVariableErrors) {
      const range = diagnostic.range
      const text = document.getText(range)

      let matchedImport: string | undefined
      let importPath: string | undefined
      let importType: 'type' | 'default' | 'namespace' | 'named' | undefined

      for (const importCfg of config.imports) {
        if (importCfg.typeImports?.includes(text)) {
          matchedImport = text
          importPath = importCfg.path
          importType = 'type'
          break
        }

        if (importCfg.defaultImports?.includes(text)) {
          matchedImport = text
          importPath = importCfg.path
          importType = 'default'
          break
        }

        if (importCfg.namespaceImports?.includes(text)) {
          matchedImport = text
          importPath = importCfg.path
          importType = 'namespace'
          break
        }

        if (importCfg.namedImports?.includes(text)) {
          matchedImport = text
          importPath = importCfg.path
          importType = 'named'
          break
        }
      }

      if (!matchedImport || !importPath || !importType) continue

      const addImportKey = `${importPath}:${matchedImport}:${importType}`

      if (addedImports.has(addImportKey)) continue

      addedImports.add(addImportKey)

      if (tsSyntacticErrors.length) {
        logToOutputChannel(
          `Skipping add import of ${
            matchedImport
          } due to presence of syntactic errors: ${tsSyntacticErrors
            .map((d) => (typeof d.code === 'number' ? d.code : 0))
            .join(', ')}`,
        )
        return
      }

      addImportToDocument(document, importPath, matchedImport, importType)
    }
  }

  const typeSubscription = vscode.languages.onDidChangeDiagnostics((event) => {
    try {
      const activeEditor = vscode.window.activeTextEditor

      if (!activeEditor) return

      const changeHappenedInActiveEditor = event.uris.includes(activeEditor.document.uri)

      if (!changeHappenedInActiveEditor) return

      checkLintErrorsInDocument(activeEditor.document)
    } catch (error) {
      logToOutputChannel(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  })

  const configSubscription = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('importOnType')) {
      logToOutputChannel('Config changed')
      updateConfig()
    }
  })

  context.subscriptions.push(typeSubscription, configSubscription, {
    dispose() {
      undoSubscription?.dispose()
      clearTimeout(disposeUndoSubscriptionTimeout)
      clearTimeout(enableAddImportTimeout)
    },
  })
}
