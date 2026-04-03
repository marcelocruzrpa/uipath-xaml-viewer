/**
 * UiPath XAML Parser v2
 * Parses both Classic and Modern Design Experience .xaml files.
 *
 * @typedef {Object} Variable
 * @property {string} name
 * @property {string} type
 * @property {string|null} default
 *
 * @typedef {Object} Argument
 * @property {string} name
 * @property {string} type
 * @property {'In'|'Out'|'In/Out'} direction
 *
 * @typedef {Object} ActivityNode
 * @property {string} id         - Stable IdRef-based identifier
 * @property {string} type       - Activity type name (e.g. 'Sequence', 'Assign')
 * @property {string} displayName
 * @property {string} category   - One of: control, decision, loop, error, data, ui, scope,
 *                                  invoke, browser, excel, mail, file, dialog, comment, sap,
 *                                  orchestrator, docai, integration, misc, label, default
 * @property {string|null} annotation
 * @property {Variable[]} variables
 * @property {ActivityNode[]} children
 * @property {Object<string, string>} properties
 * @property {boolean} collapsed
 * @property {string} [screenshot]   - Base64 encoded image data
 *
 * @typedef {Object} FlowNode
 * @property {string} flowType       - 'FlowStep' | 'FlowDecision' | 'FlowSwitch'
 * @property {string} id
 * @property {string[]} refIds
 * @property {string} displayName
 * @property {string} category
 * @property {string|null} annotation
 * @property {Object<string, string>} properties
 * @property {ActivityNode|null} innerActivity
 * @property {string} [activityType] - Type of the inner activity (FlowStep only)
 * @property {string} [condition]    - Decision condition (FlowDecision only)
 * @property {string} [expression]   - Switch expression (FlowSwitch only)
 * @property {boolean} [collapsed]
 *
 * @typedef {Object} FlowEdge
 * @property {string} from  - Source node id
 * @property {string} to    - Target node id
 * @property {string} label - Edge label ('True', 'False', 'Default', case key, or '')
 *
 * @typedef {Object} StateNode
 * @property {string} id
 * @property {string[]} refIds
 * @property {string} displayName
 * @property {boolean} isFinal
 * @property {string} category
 * @property {string|null} annotation
 * @property {Object<string, string>} properties
 * @property {ActivityNode|null} entryNode
 * @property {boolean} collapsed
 *
 * @typedef {Object} StateEdge
 * @property {string} from
 * @property {string} to
 * @property {string} label
 * @property {string} condition
 * @property {ActivityNode|null} trigger
 * @property {ActivityNode|null} action
 * @property {string|null} annotation
 *
 * @typedef {Object} ParseResult
 * @property {string} name
 * @property {Argument[]} arguments
 * @property {ActivityNode & { flowNodes?: FlowNode[], flowEdges?: FlowEdge[], startNode?: FlowNode|null, stateNodes?: StateNode[], stateEdges?: StateEdge[], initialStateId?: string }} tree
 * @property {string} [error]
 */
window.UiPathParser = (() => {

  const CATEGORY_MAP = {
    // Control flow
    Sequence: 'control', Flowchart: 'control', FlowDecision: 'decision',
    FlowSwitch: 'decision', If: 'decision', Switch: 'decision',
    While: 'loop', DoWhile: 'loop', ForEach: 'loop', ParallelForEach: 'loop',
    ForEachRow: 'loop',
    Parallel: 'loop', Pick: 'control', PickBranch: 'control',
    StateMachine: 'control', State: 'control', FinalState: 'control',
    TryCatch: 'error', Catch: 'error', Throw: 'error', Rethrow: 'error',
    Retry: 'error', RetryScope: 'error', TerminateWorkflow: 'error',
    Break: 'control', Continue: 'control',

    // Data
    Assign: 'data', MultipleAssign: 'data', AddToCollection: 'data',
    RemoveFromCollection: 'data', ClearCollection: 'data',
    ExistsInCollection: 'data', BuildDataTable: 'data',
    AddDataRow: 'data', RemoveDataRow: 'data', FilterDataTable: 'data',
    SortDataTable: 'data', MergeDataTable: 'data', JoinDataTables: 'data',
    LookupDataTable: 'data', OutputDataTable: 'data',
    RemoveDuplicateRows: 'data', SetVariable: 'data',

    // UI Automation (Classic)
    Click: 'ui', TypeInto: 'ui', GetText: 'ui', GetAttribute: 'ui',
    SetText: 'ui', Check: 'ui', SelectItem: 'ui', Hover: 'ui',
    DoubleClick: 'ui', SendHotkey: 'ui', ElementExists: 'ui',
    FindElement: 'ui', FindChildren: 'ui', FindRelativeElement: 'ui',
    WaitElementVanish: 'ui', Highlight: 'ui', GetPosition: 'ui',
    SetFocus: 'ui', Screenshot: 'ui', TakeScreenshot: 'ui',

    // UI Automation (Modern / UIAutomationNext)
    UseApplication: 'scope', UseBrowser: 'scope',
    ClickX: 'ui', TypeIntoX: 'ui', GetTextX: 'ui', GetAttributeX: 'ui',
    SetTextX: 'ui', CheckX: 'ui', SelectItemX: 'ui', HoverX: 'ui',
    DoubleClickX: 'ui', SendHotkeyX: 'ui', ElementExistsX: 'ui',
    FindElementX: 'ui', HighlightX: 'ui', ScreenshotX: 'ui',
    ExtractDataTable: 'ui', ExtractTableData: 'ui',
    KeyboardShortcut: 'ui', MouseScroll: 'ui',
    ApplicationCard: 'scope', BrowserCard: 'scope',
    ObjectContainer: 'scope',
    // UI Automation (N-prefix / Studio Web)
    NClick: 'ui', NTypeInto: 'ui', NGetText: 'ui', NGetAttribute: 'ui',
    NSetText: 'ui', NCheck: 'ui', NSelectItem: 'ui', NHover: 'ui',
    NDoubleClick: 'ui', NSendHotkey: 'ui', NElementExists: 'ui',
    NFindElement: 'ui', NHighlight: 'ui', NScreenshot: 'ui',
    NCheckState: 'ui', NGetColor: 'ui', NMouseScroll: 'ui',
    NKeyboardShortcut: 'ui', NExtractDataTable: 'ui',
    NApplicationCard: 'scope', NBrowserCard: 'scope',

    // Invocation
    InvokeWorkflowFile: 'invoke', InvokeCode: 'invoke',
    InvokePowerShell: 'invoke', InvokeMethod: 'invoke',
    InvokeVBScript: 'invoke', InvokeProcess: 'invoke',
    RunParallelProcess: 'invoke',

    // Browser / Web
    OpenBrowser: 'browser', CloseBrowser: 'browser', NavigateTo: 'browser',
    GoBack: 'browser', GoForward: 'browser', RefreshBrowser: 'browser',
    AttachBrowser: 'browser', CloseTab: 'browser',
    HttpClient: 'browser', DeserializeJson: 'data', SerializeJson: 'data',
    DeserializeXml: 'data', SerializeXml: 'data',
    HTTPRequest: 'browser',

    // Excel (Classic + Modern)
    ExcelApplicationScope: 'excel', ReadRange: 'excel', WriteRange: 'excel',
    ReadCell: 'excel', WriteCell: 'excel', DeleteColumn: 'excel',
    InsertColumn: 'excel', AppendRange: 'excel',
    UseExcelFile: 'excel', ForEachExcelRow: 'excel',
    ReadRangeX: 'excel', WriteRangeX: 'excel',
    ReadCellX: 'excel', WriteCellX: 'excel',
    ExcelInsertDeleteRows: 'excel', ExcelInsertDeleteColumns: 'excel',
    AutoFillRange: 'excel', CreatePivotTable: 'excel',
    VLookup: 'excel', FormatCells: 'excel',
    SaveWorkbook: 'excel', CloseWorkbook: 'excel',

    // Mail (Classic + Modern)
    SendSmtpMailMessage: 'mail', GetImapMailMessages: 'mail',
    GetOutlookMailMessages: 'mail', SendOutlookMailMessage: 'mail',
    GetPOP3MailMessages: 'mail', GetExchangeMailMessages: 'mail',
    MoveMail: 'mail', ForwardMail: 'mail', ReplyToMail: 'mail',
    SaveMailMessage: 'mail', SaveAttachments: 'mail',
    UseOutlookAccount: 'mail', UseGmailAccount: 'mail',
    SendEmail: 'mail', GetEmail: 'mail',
    UseDesktopOutlook: 'mail',

    // File system
    PathExists: 'file', CreateDirectory: 'file', CreateFile: 'file',
    CopyFile: 'file', MoveFile: 'file', DeleteFileOrFolder: 'file',
    ReadTextFile: 'file', WriteTextFile: 'file', AppendLine: 'file',
    GetFiles: 'file', ForEachFolder: 'file',
    CompressZipFiles: 'file', ExtractUnzipFiles: 'file',
    IterateFiles: 'file', ReadCSV: 'file', WriteCSV: 'file',

    // Dialog / User / Action Center
    MessageBox: 'dialog', InputDialog: 'dialog', LogMessage: 'dialog',
    Comment: 'comment', CommentOut: 'comment',
    CreateForm: 'dialog', WaitFormTask: 'dialog',
    CreateExternalTask: 'dialog', WaitExternalTask: 'dialog',
    FormTask: 'dialog', ExternalTask: 'dialog',
    CreateFormTask: 'dialog', WaitFormTaskAndResume: 'dialog',

    // Document Understanding
    DigitizeDocument: 'docai', ClassifyDocument: 'docai',
    ExtractDocumentData: 'docai', ValidateExtractionResults: 'docai',
    TrainClassifier: 'docai', TrainExtractor: 'docai',
    IntelligentOCR: 'docai',

    // SAP
    SAPLogin: 'sap', SAPLogon: 'sap',

    // Orchestrator
    AddQueueItem: 'orchestrator', GetQueueItems: 'orchestrator',
    GetTransactionItem: 'orchestrator', SetTransactionStatus: 'orchestrator',
    AddTransactionItem: 'orchestrator', PostponeTransactionItem: 'orchestrator',
    GetAsset: 'orchestrator', SetAsset: 'orchestrator',
    GetCredential: 'orchestrator', SetCredential: 'orchestrator',
    StartJob: 'orchestrator', StopJob: 'orchestrator',
    TriggerJob: 'orchestrator', GetJobs: 'orchestrator',
    ShouldStop: 'orchestrator',
    StorageFileExists: 'orchestrator', ReadStorageText: 'orchestrator',
    WriteStorageText: 'orchestrator', DeleteStorageFile: 'orchestrator',

    // Misc
    Delay: 'misc', NOP: 'misc',
  };

  const SKIP_TAGS = new Set([
    'Activity', 'TextExpression', 'Literal', 'VisualBasicReference',
    'VisualBasicValue', 'VisualBasicSettings', 'NamespaceList',
    'AssemblyReference', 'ImportedNamespace',
    'CSharpValue', 'CSharpReference',
    'PropertyReferenceExtension',
    'InArgument', 'OutArgument', 'InOutArgument',
    'Variable', 'VariableReference', 'VariableValue',
    'Reference', 'LambdaValue', 'LambdaReference',
    'Default', 'Members', 'Property',
    'WorkflowViewStateService', 'ViewStateData', 'ViewStateManager',
    'Target', 'TargetAnchorable', 'CustomInput', 'InputConfiguration', 'OutputConfiguration',
    'ExtractDataSettings', 'ExtractMetadata',
    'ArgumentCollection', 'Selector', 'SelectorTarget',
    'UnifiedTarget', 'UnifiedApplicationTarget',
    'ContinueOnError', 'TimeoutMS',
    // Delegate internals (ForEach, ForEachRow, Parallel, etc.)
    'DelegateInArgument', 'DelegateOutArgument', 'DelegateArgument',
    // .NET collection types used as structural wrappers
    'Dictionary', 'List', 'Collection', 'ObservableCollection',
  ]);

  const PROPERTY_WRAPPER_SKIPS = new Set(['Variables', 'WorkflowViewState', 'ViewState', 'AssignOperations']);
  const BODY_WRAPPERS = new Set(['Body', 'Activities']);

  function getCategory(name) {
    return CATEGORY_MAP[name] || 'default';
  }

  function stripNS(el) {
    return el.localName || el.tagName.split(':').pop();
  }

  let _idCounter = 0;
  function nextId(prefix) {
    return prefix + '_auto_' + (++_idCounter);
  }

  function getRefIds(el, prefix = 'n') {
    const ids = [
      el.getAttribute('x:Name'),
      el.getAttribute('sap2010:WorkflowViewState.IdRef'),
    ].filter(Boolean);
    return ids.length > 0 ? [...new Set(ids)] : [nextId(prefix)];
  }

  function getNodeId(el, prefix = 'n') {
    return getRefIds(el, prefix)[0];
  }

  function normalizeText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function extractPropertyValue(el) {
    const text = normalizeText(el.textContent || '');
    if (text) {
      return text.length > 240 ? text.slice(0, 237) + '...' : text;
    }
    // Fallback: expression wrappers store values in attributes, not text
    const exprEl = el.querySelector('[ExpressionText]')
      || el.querySelector('[Expression]');
    if (exprEl) {
      const expr = normalizeText(
        exprEl.getAttribute('ExpressionText')
        || exprEl.getAttribute('Expression') || ''
      );
      if (expr) {
        return expr.length > 240 ? expr.slice(0, 237) + '...' : expr;
      }
    }
    return null;
  }

  function setPropertyValue(target, key, value) {
    if (!key || !value) return;
    if (!Object.prototype.hasOwnProperty.call(target.properties, key)) {
      target.properties[key] = value;
      return;
    }
    const existing = String(target.properties[key]);
    if (existing !== String(value) && !existing.includes(String(value))) {
      target.properties[key] = existing + ' | ' + value;
    }
  }

  function getDisplayName(el) {
    return el.getAttribute('DisplayName')
      || el.getAttribute('sap2010:Annotation.AnnotationText')
      || null;
  }

  function getAnnotation(el) {
    return el.getAttribute('sap2010:Annotation.AnnotationText') || null;
  }

  function isActivityElement(el) {
    const tag = stripNS(el);
    if (tag.includes('.')) return false;
    if (SKIP_TAGS.has(tag)) return false;
    if (el.children.length === 0 && !CATEGORY_MAP[tag] && !el.getAttribute('DisplayName')) {
      const ns = el.namespaceURI || '';
      if (!ns.includes('UiPath') && !ns.includes('xaml/activities')) {
        return false;
      }
    }
    return true;
  }

  function isFlowNodeTag(tag) {
    return ['FlowStep', 'FlowDecision', 'FlowSwitch'].includes(tag);
  }

  function findFlowNodeElement(el) {
    if (!el) return null;
    const tag = stripNS(el);
    if (isFlowNodeTag(tag)) return el;
    for (const child of el.children || []) {
      const found = findFlowNodeElement(child);
      if (found) return found;
    }
    return null;
  }

  function parseVariables(scopeEl) {
    const vars = [];
    for (const child of scopeEl.children) {
      const tag = stripNS(child);
      if (tag.endsWith('.Variables') || tag === 'Variables') {
        for (const v of child.children) {
          if (stripNS(v) === 'Variable') {
            const typeAttr = v.getAttribute('TypeArguments')
              || v.getAttribute('x:TypeArguments')
              || '';
            vars.push({
              name: v.getAttribute('Name') || v.getAttribute('x:Name') || '?',
              type: typeAttr.replace(/^x:|^s:/g, '').replace(/^scg:/, 'Generic.'),
              default: v.getAttribute('Default') || null,
            });
          }
        }
      }
    }
    return vars;
  }

  function parseArguments(rootEl) {
    const args = [];
    for (const child of rootEl.children) {
      const tag = stripNS(child);
      if (tag === 'Members' || tag === 'x:Members') {
        for (const prop of child.children) {
          if (stripNS(prop) === 'Property') {
            const name = prop.getAttribute('Name') || prop.getAttribute('x:Name') || '?';
            const type = prop.getAttribute('Type') || '';
            let direction = 'In';
            if (type.startsWith('OutArgument')) direction = 'Out';
            else if (type.startsWith('InOutArgument')) direction = 'In/Out';
            const cleanType = type.replace(/^x:|^s:/g, '').replace(/^scg:/, 'Generic.').replace(/\b(sd|s|scg|sco|x):(\w)/g, '$2').replace(/^(In|Out|InOut)Argument\((.+)\)$/, '$2');
            args.push({ name, type: cleanType, direction });
          }
        }
      }
    }
    return args;
  }

  function createBaseNode(el, type) {
    return {
      id: getNodeId(el),
      type,
      displayName: getDisplayName(el) || type,
      category: getCategory(type),
      annotation: getAnnotation(el),
      variables: parseVariables(el),
      children: [],
      properties: {},
      collapsed: false,
    };
  }

  const SKIP_ATTRS = new Set([
    'DisplayName', 'sap2010:WorkflowViewState.IdRef', 'sap2010:Annotation.AnnotationText',
    'ScopeIdentifier', 'Version', 'Implementation', 'Area', 'ContentHash', 'UnSafe',
    'DesignTimeRectangle', 'FriendlyName', 'Guid',
    'IsResponsive', 'ScopeGuid',
    'IsFinal', 'Private', 'AutoLog', 'DisableTrace',
  ]);

  const SCREENSHOT_ATTRS = new Set(['ImageBase64', 'InformativeScreenshot']);

  function isBase64Image(val) {
    return val && val.length > 100 && /^[A-Za-z0-9+/]/.test(val) && !val.includes('.');
  }

  function collectAttributeProperties(el, node) {
    for (const attr of el.attributes) {
      const name = attr.name;
      if (SCREENSHOT_ATTRS.has(name)) {
        if (isBase64Image(attr.value)) node.screenshot = attr.value;
        continue;
      }
      if (SKIP_ATTRS.has(name)) continue;
      if (name.startsWith('xmlns') || name.startsWith('x:') || name.startsWith('mc:') || name.startsWith('sap:') || name.startsWith('sap2010:')) continue;
      node.properties[name] = attr.value;
    }
  }

  function createLabelNode(propName, children) {
    return {
      id: nextId('label'),
      type: '§' + propName,
      displayName: propName,
      category: 'label',
      children,
      variables: [],
      properties: {},
      annotation: null,
      collapsed: false,
    };
  }

  function mergeTargetProperties(node, targetEl) {
    function walk(el, prefix) {
      for (const attr of el.attributes) {
        const name = attr.name;
        if (name.startsWith('xmlns') || name.startsWith('x:') || name.startsWith('mc:') || name.startsWith('sap:') || name.startsWith('sap2010:')) continue;
        if (SKIP_ATTRS.has(name)) continue;
        if (SCREENSHOT_ATTRS.has(name)) {
          if (isBase64Image(attr.value)) node.screenshot = attr.value;
          continue;
        }
        setPropertyValue(node, prefix + name, attr.value);
      }
      for (const child of el.children) {
        const tag = stripNS(child);
        if (tag.includes('.')) {
          const prop = tag.split('.').pop();
          const val = extractPropertyValue(child);
          if (val) setPropertyValue(node, prefix + prop, val);
        } else if (SKIP_TAGS.has(tag)) {
          walk(child, prefix);
        }
      }
    }
    for (const child of targetEl.children) {
      walk(child, 'Target.');
    }
  }

  function handlePropertyWrapper(node, wrapperEl) {
    const propName = stripNS(wrapperEl).split('.').pop();
    if (PROPERTY_WRAPPER_SKIPS.has(propName) || SKIP_ATTRS.has(propName)) return;

    if (SCREENSHOT_ATTRS.has(propName)) {
      const val = normalizeText(wrapperEl.textContent || '');
      if (isBase64Image(val)) node.screenshot = val;
      return;
    }

    if (propName === 'Target') {
      mergeTargetProperties(node, wrapperEl);
      return;
    }

    const subChildren = [];
    for (const child of wrapperEl.children) {
      if (isActivityElement(child)) {
        subChildren.push(buildNode(child));
      }
    }

    if (subChildren.length > 0) {
      if (BODY_WRAPPERS.has(propName)) {
        node.children.push(...subChildren);
      } else {
        node.children.push(createLabelNode(propName, subChildren));
      }
      return;
    }

    const value = extractPropertyValue(wrapperEl);
    if (value) setPropertyValue(node, propName, value);
  }

  function buildFlowNode(el, refMap) {
    const tag = stripNS(el);
    const refIds = getRefIds(el, 'f');
    const node = {
      flowType: tag,
      id: refIds[0],
      refIds,
      displayName: getDisplayName(el) || tag,
      category: getCategory(tag),
      annotation: getAnnotation(el),
      properties: {},
      innerActivity: null,
      _nextEl: null,
      _trueEl: null,
      _falseEl: null,
      _defaultEl: null,
      _cases: [],
    };

    refIds.forEach((id) => refMap.set(id, node));

    if (tag === 'FlowStep') {
      for (const child of el.children) {
        const childTag = stripNS(child);
        if (childTag === 'FlowStep.Next') {
          node._nextEl = child.children[0] || null;
        } else if (isActivityElement(child)) {
          const act = buildNode(child);
          node.displayName = act.displayName;
          node.category = act.category;
          node.annotation = act.annotation || node.annotation;
          node.properties = { ...act.properties };
          node.innerActivity = act;
          node.activityType = act.type;
        } else if (childTag.includes('.')) {
          handlePropertyWrapper(node, child);
        }
      }
      if (node.innerActivity?.children?.length > 0) node.collapsed = true;
    } else if (tag === 'FlowDecision') {
      node.category = 'decision';
      node.condition = el.getAttribute('Condition') || '';
      for (const child of el.children) {
        const childTag = stripNS(child);
        if (childTag === 'FlowDecision.True') node._trueEl = child.children[0] || null;
        else if (childTag === 'FlowDecision.False') node._falseEl = child.children[0] || null;
        else if (childTag === 'FlowDecision.Condition' && !node.condition) node.condition = extractPropertyValue(child) || '';
      }
      node.displayName = getDisplayName(el) || node.condition || 'Decision';
      if (node.condition) node.properties.Condition = node.condition;
    } else if (tag === 'FlowSwitch') {
      node.category = 'decision';
      node.expression = el.getAttribute('Expression') || '';
      for (const child of el.children) {
        const childTag = stripNS(child);
        if (childTag === 'FlowSwitch.Default') node._defaultEl = child.children[0] || null;
        else if (childTag === 'FlowSwitch.Expression' && !node.expression) node.expression = extractPropertyValue(child) || '';
        const key = child.getAttribute && child.getAttribute('x:Key');
        if (key != null) {
          node._cases.push({ key, el: child });
        }
      }
      node.displayName = getDisplayName(el) || (node.expression ? 'Switch: ' + node.expression : 'Switch');
      if (node.expression) node.properties.Expression = node.expression;
    }

    return node;
  }

  function buildFlowchartNode(el, node) {
    node.flowNodes = [];
    node.flowEdges = [];
    node.startNode = null;

    const refMap = new Map();
    const queued = [];

    const ensureFlowNode = (candidate) => {
      const flowEl = findFlowNodeElement(candidate);
      if (!flowEl) return null;
      const existingId = getRefIds(flowEl, 'f').find((id) => refMap.has(id));
      if (existingId) return refMap.get(existingId);
      const flowNode = buildFlowNode(flowEl, refMap);
      node.flowNodes.push(flowNode);
      queued.push(flowNode);
      return flowNode;
    };

    for (const child of el.children) {
      const childTag = stripNS(child);
      if (childTag === 'Flowchart.StartNode') {
        node.startNode = ensureFlowNode(child.children[0]);
      } else if (isFlowNodeTag(childTag)) {
        ensureFlowNode(child);
      } else if (childTag.includes('.')) {
        handlePropertyWrapper(node, child);
      }
    }

    while (queued.length > 0) {
      const flowNode = queued.shift();
      if (flowNode._nextEl) ensureFlowNode(flowNode._nextEl);
      if (flowNode._trueEl) ensureFlowNode(flowNode._trueEl);
      if (flowNode._falseEl) ensureFlowNode(flowNode._falseEl);
      if (flowNode._defaultEl) ensureFlowNode(flowNode._defaultEl);
      for (const cs of flowNode._cases || []) ensureFlowNode(cs.el);
    }

    if (node.startNode) {
      node.flowNodes = [node.startNode, ...node.flowNodes.filter((fn) => fn.id !== node.startNode.id)];
    }

    collectFlowEdges(node, ensureFlowNode);
    return node;
  }

  function resolveReferenceValue(value) {
    if (!value) return null;
    const refMatch = value.match(/\{x:Reference\s+([^}]+)\}/);
    return refMatch ? refMatch[1].trim() : value;
  }

  function buildStateMachineNode(el, node) {
    node.stateNodes = [];
    node.stateEdges = [];
    node.initialStateId = resolveReferenceValue(el.getAttribute('InitialState'));
    const stateAliasMap = new Map();
    const stateElements = new Map();

    // Handle StateMachine-level property wrappers (e.g., Variables)
    for (const child of el.children) {
      const childTag = stripNS(child);
      if (childTag.includes('.') && childTag !== 'State' && childTag !== 'FinalState') {
        handlePropertyWrapper(node, child);
      }
    }

    // Recursively find all State/FinalState elements
    // UiPath XAML nests inline state definitions inside Transition.To
    function collectStates(parent) {
      for (const child of parent.children) {
        const childTag = stripNS(child);
        if (childTag === 'State' || childTag === 'FinalState') {
          const refIds = getRefIds(child, 'sm');
          if (stateAliasMap.has(refIds[0])) continue;
          const isFinal = childTag === 'FinalState' || child.getAttribute('IsFinal') === 'True';
          const stateNode = {
            id: refIds[0],
            refIds,
            displayName: getDisplayName(child) || childTag,
            isFinal,
            category: isFinal ? 'error' : 'control',
            annotation: getAnnotation(child),
            properties: {},
            entryNode: null,
            collapsed: true,
          };
          for (const stateChild of child.children) {
            if (stripNS(stateChild) === 'State.Entry') {
              for (const inner of stateChild.children) {
                if (isActivityElement(inner)) {
                  stateNode.entryNode = buildNode(inner);
                  break;
                }
              }
              break;
            }
          }
          node.stateNodes.push(stateNode);
          refIds.forEach((id) => stateAliasMap.set(id, stateNode.id));
          stateElements.set(stateNode.id, child);
          // Recurse into transitions to find nested state definitions
          for (const stateChild of child.children) {
            if (stripNS(stateChild) === 'State.Transitions') {
              collectStates(stateChild);
            }
          }
        } else {
          collectStates(child);
        }
      }
    }

    collectStates(el);

    // Parse transitions from all discovered states
    for (const [stateId, stateEl] of stateElements) {
      for (const stateChild of stateEl.children) {
        if (stripNS(stateChild) !== 'State.Transitions') continue;
        for (const transition of stateChild.children) {
          if (stripNS(transition) !== 'Transition') continue;
          let targetId = resolveReferenceValue(transition.getAttribute('To'));
          let condition = '';
          let trigger = null;
          let action = null;
          for (const transitionChild of transition.children) {
            const transitionTag = stripNS(transitionChild);
            if (transitionTag === 'Transition.To' && !targetId) {
              const refEl = transitionChild.children[0];
              if (refEl) {
                const refTag = stripNS(refEl);
                if (refTag === 'State' || refTag === 'FinalState') {
                  targetId = getNodeId(refEl, 'sm');
                } else {
                  targetId = refEl.getAttribute('x:Reference')
                    || refEl.getAttribute('sap2010:WorkflowViewState.IdRef')
                    || normalizeText(refEl.textContent);
                }
              }
            } else if (transitionTag === 'Transition.Condition') {
              condition = extractPropertyValue(transitionChild) || '';
            } else if (transitionTag === 'Transition.Trigger') {
              const triggerEl = transitionChild.children[0];
              if (triggerEl && isActivityElement(triggerEl)) {
                trigger = buildNode(triggerEl);
              }
            } else if (transitionTag === 'Transition.Action') {
              const actionEl = transitionChild.children[0];
              if (actionEl && isActivityElement(actionEl)) {
                action = buildNode(actionEl);
              }
            }
          }
          if (targetId) {
            node.stateEdges.push({
              from: stateId,
              to: stateAliasMap.get(targetId) || targetId,
              label: getDisplayName(transition) || condition || '',
              condition,
              trigger: trigger || null,
              action: action || null,
              annotation: getAnnotation(transition),
            });
          }
        }
      }
    }

    if (node.initialStateId) node.initialStateId = stateAliasMap.get(node.initialStateId) || node.initialStateId;
    if (!node.initialStateId && node.stateNodes.length > 0) {
      node.initialStateId = node.stateNodes[0].id;
    }

    return node;
  }

  function collectFlowEdges(fcNode, ensureFlowNode) {
    const idMap = new Map();
    fcNode.flowNodes.forEach((node) => {
      (node.refIds || [node.id]).forEach((id) => idMap.set(id, node));
    });
    fcNode.flowEdges = [];

    const resolveTarget = (el) => {
      if (!el) return null;
      const ref = el.getAttribute && el.getAttribute('x:Reference');
      if (ref && idMap.has(ref)) return ref;
      const idRef = el.getAttribute && el.getAttribute('sap2010:WorkflowViewState.IdRef');
      if (idRef && idMap.has(idRef)) return idRef;
      const inline = ensureFlowNode ? ensureFlowNode(el) : null;
      if (inline) {
        idMap.set(inline.id, inline);
        return inline.id;
      }
      return null;
    };

    for (const node of fcNode.flowNodes) {
      const nextId = resolveTarget(node._nextEl);
      if (nextId) fcNode.flowEdges.push({ from: node.id, to: nextId, label: '' });

      const trueId = resolveTarget(node._trueEl);
      if (trueId) fcNode.flowEdges.push({ from: node.id, to: trueId, label: 'True' });

      const falseId = resolveTarget(node._falseEl);
      if (falseId) fcNode.flowEdges.push({ from: node.id, to: falseId, label: 'False' });

      const defaultId = resolveTarget(node._defaultEl);
      if (defaultId) fcNode.flowEdges.push({ from: node.id, to: defaultId, label: 'Default' });

      for (const cs of node._cases || []) {
        const caseId = resolveTarget(cs.el);
        if (caseId) fcNode.flowEdges.push({ from: node.id, to: caseId, label: cs.key });
      }
    }
  }

  function unwrapActivityAction(el) {
    // Find the inner body activity, skipping delegate arguments and property wrappers
    for (const child of el.children) {
      const childTag = stripNS(child);
      if (!childTag.includes('.') && isActivityElement(child)) {
        return buildNode(child);
      }
    }
    // Check property wrappers for Handler/Body
    for (const child of el.children) {
      const childTag = stripNS(child);
      if (childTag.endsWith('.Handler') || childTag.endsWith('.Body')) {
        for (const inner of child.children) {
          if (isActivityElement(inner)) return buildNode(inner);
        }
      }
    }
    return null;
  }

  function buildNode(el) {
    const tag = stripNS(el);

    // Transparent unwrap: ActivityAction delegates expose only their inner body
    if (tag === 'ActivityAction') {
      return unwrapActivityAction(el) || createBaseNode(el, tag);
    }

    const node = createBaseNode(el, tag);

    if (['UseApplication', 'UseBrowser', 'UseExcelFile',
      'UseOutlookAccount', 'UseGmailAccount', 'UseDesktopOutlook',
      'ExcelApplicationScope', 'ApplicationCard', 'BrowserCard',
      'ObjectContainer'].includes(tag)) {
      node.category = 'scope';
    }

    collectAttributeProperties(el, node);

    if (tag === 'Flowchart') return buildFlowchartNode(el, node);
    if (tag === 'StateMachine') return buildStateMachineNode(el, node);

    for (const child of el.children) {
      const childTag = stripNS(child);
      if (childTag.includes('.')) {
        handlePropertyWrapper(node, child);
      } else if (isActivityElement(child)) {
        node.children.push(buildNode(child));
      } else if (SCREENSHOT_ATTRS.has(childTag)) {
        const val = normalizeText(child.textContent || '');
        if (isBase64Image(val)) node.screenshot = val;
      } else {
        const value = extractPropertyValue(child);
        if (value && !PROPERTY_WRAPPER_SKIPS.has(childTag) && !SKIP_ATTRS.has(childTag)) {
          setPropertyValue(node, childTag, value);
        }
      }
    }

    return node;
  }

  function parse(xmlString) {
    _idCounter = 0;
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    const error = doc.querySelector('parsererror');
    if (error) {
      return { error: 'Failed to parse XAML: ' + error.textContent.slice(0, 200) };
    }

    const root = doc.documentElement;
    const rootTag = stripNS(root);
    let bodyEl = null;
    if (rootTag === 'Activity') {
      for (const child of root.children) {
        const tag = stripNS(child);
        if (['Sequence', 'Flowchart', 'StateMachine'].includes(tag)) {
          bodyEl = child;
          break;
        }
      }
      if (!bodyEl) {
        for (const child of root.children) {
          if (isActivityElement(child)) {
            bodyEl = child;
            break;
          }
        }
      }
    } else if (['Sequence', 'Flowchart', 'StateMachine'].includes(rootTag)) {
      bodyEl = root;
    }

    const argumentsList = parseArguments(root);

    if (!bodyEl) {
      return {
        name: root.getAttribute('DisplayName') || 'Workflow',
        arguments: argumentsList,
        tree: {
          id: 'empty',
          type: 'Empty',
          displayName: 'No activities found',
          category: 'default',
          children: [],
          variables: [],
          properties: {},
          annotation: null,
          collapsed: false,
        },
      };
    }

    const tree = buildNode(bodyEl);

    return {
      name: root.getAttribute('DisplayName') || getDisplayName(bodyEl) || stripNS(bodyEl),
      arguments: argumentsList,
      tree,
    };
  }

  return { parse, getCategory, CATEGORY_MAP };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.UiPathParser;
}
