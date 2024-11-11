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

  async function addImportToDocument(
    document: vscode.TextDocument,
    importPath: string,
    matchedImport: string,
    importType: 'type' | 'default' | 'namespace' | 'named',
  ) {
    const edit = new vscode.WorkspaceEdit()

    // Find all import statements in the document
    const fullText = document.getText()
    const importRegex = /^import .+$/gm
    let lastImportMatch: RegExpExecArray | null = null
    let match: RegExpExecArray | null

    while ((match = importRegex.exec(fullText)) !== null) {
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
    const importStatement = `import ${importSpecifier} from '${importPath}'`

    // Add newline before the import if we're not at the start of the file
    const textToInsert = lastImportMatch ? `\n${importStatement}` : `${importStatement}\n`

    edit.insert(document.uri, position, textToInsert)

    await vscode.workspace.applyEdit(edit)

    if (config.triggerOrganizeImports) {
      vscode.commands.executeCommand('editor.action.organizeImports')
    }
  }

  function checkLintErrorsInDocument(document: vscode.TextDocument) {
    const diagnostics = vscode.languages.getDiagnostics(document.uri)

    const tsUndefinedVariableErrors = diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === 2304 || diagnostic.code === 2582 || diagnostic.code === 2552,
    )

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

      addImportToDocument(document, importPath, matchedImport, importType)
    }
  }

  const typeSubscription = vscode.languages.onDidChangeDiagnostics((event) => {
    const activeEditor = vscode.window.activeTextEditor

    if (!activeEditor) return

    const changeHappenedInActiveEditor = event.uris.includes(activeEditor.document.uri)

    if (!changeHappenedInActiveEditor) return

    checkLintErrorsInDocument(activeEditor.document)
  })

  const configSubscription = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('importOnType')) {
      console.info('Config changed')
      updateConfig()
    }
  })

  context.subscriptions.push(typeSubscription, configSubscription)
}
