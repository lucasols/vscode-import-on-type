import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
  type ImportCfg = {
    variableOrFn: string
    path: string
    isTypeImport: boolean
  }

  const config: {
    imports: Map<string, ImportCfg>
    triggerOrganizeImports: boolean
  } = {
    imports: new Map(),
    triggerOrganizeImports: true,
  }

  function updateConfig() {
    const importsConfig =
      vscode.workspace.getConfiguration('importOnType').get<ImportCfg[]>('imports') ?? []

    const configByVariableOrFn = new Map<string, ImportCfg>(
      importsConfig.map((cfg) => [cfg.variableOrFn, cfg]),
    )

    config.imports = configByVariableOrFn

    config.triggerOrganizeImports =
      vscode.workspace
        .getConfiguration('importOnType')
        .get<boolean>('triggerOrganizeImports') ?? true
  }

  updateConfig()

  async function addImportToDocument(
    document: vscode.TextDocument,
    importCfg: ImportCfg,
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

    const importStatement = `import ${
      importCfg.isTypeImport ? 'type ' : ''
    } { ${importCfg.variableOrFn} } from '${importCfg.path}'`

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
      (diagnostic) => diagnostic.code === 2304,
    )

    for (const diagnostic of tsUndefinedVariableErrors) {
      const range = diagnostic.range
      const text = document.getText(range)

      const importCfg = config.imports.get(text)

      if (!importCfg) continue

      addImportToDocument(document, importCfg)
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
