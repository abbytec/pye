export const LANGUAGE_EXTENSIONS: { [key: string]: string } = {
    '.js': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.go': 'go',
    '.ruby': 'ruby',
    '.c': 'c',
    '.php': 'php',
    '.ts': 'typescript',
    '.swift': 'swift',
    '.rs': 'rust',
    '.scala': 'scala',
    '.kotlin': 'kotlin',
    '.dart': 'dart',
    '.h': 'c',
    '.m': 'objective-c',
    '.r': 'r',
    '.pl': 'perl',
    '.sh': 'bash',
    '.bat': 'batch',
    '.zsh': 'zsh',
    '.sql': 'sql',
    '.asm': 'assembly',
    '.lua': 'lua',
    '.vhdl': 'vhdl',
    '.f90': 'fortran',
    '.v': 'verilog',
    '.tcl': 'tcl',
    '.groovy': 'groovy',
    '.clojure': 'clojure',
    '.el': 'elisp',
    '.lisp': 'lisp',
    '.ocaml': 'ocaml',
    '.haskell': 'haskell',
    '.fsharp': 'fsharp',
    '.nim': 'nim',
    '.sol': 'solidity',
    '.ada': 'ada',
    '.raku': 'raku',
    '.coffee': 'coffee-script',
    '.sml': 'sml',
    '.idl': 'idl',
    '.d': 'd',
    '.erl': 'erlang',
    '.ex': 'elixir',
    '.exs': 'elixir',
    '.abc': 'abc',
    '.pcl': 'prolog',
    '.pyx': 'cython',
    '.vlang': 'vlang',
    '.dmd': 'dmd',
    '.spx': 'spark',
    '.jsp': 'jsp',
    '.nimble': 'nim',
    '.mjs': 'javascript',
    '.rmd': 'rmarkdown',
    '.sv': 'systemverilog',
    '.hx': 'haxe',
    '.ml': 'ocaml',
    '.j': 'j',
    '.x86': 'assembly',
    '.yml': 'yaml',
    '.json': 'json',
    '.graphql': 'graphql',
    '.proto': 'protobuf',
};

export const LANGUAGE_PATTERNS = {
    python: [
        /def\s+\w+\s*\(/,              // funcion
        /\bprint\s*\(.*\)/,            // print
        /import\s+\w+/,                // import
    ],
    javascript: [
        /function\s+\w*\s*\(/,         // funcion
        /\bconsole\.\w+\s*\(.*\)/,     // console
        /export\s+(default|const|function|class)/, // export
        /\bvar\s+\w+|let\s+\w+|const\s+\w+/, // variables
    ],
    java: [
        /import\s+java\./,             // imports
        /\bpublic\s+(class|static|void)\b/, // declaraciones
        /\bSystem\.out\.print/,        // console
    ],
    c: [
        /#include\s+<\w+\.h>/,         // includes
        /\bprintf\s*\(.*\);/,          // printf
        /\bscanf\s*\(.*\);/,           // scanf
    ],
    cpp: [
        /#include\s+<\w+\.h>/,         // includes
        /\bstd::cout\s*<<.*/,          // C++ output
        /\bstd::cin\s*>>.*/,           // C++ input
        /class\s+\w+/,                 // clase
    ],
    ruby: [
        /\bdef\s+\w+/,                 // funcion
        /\bputs\s+["'].*["']/,         // console
        /\bclass\s+\w+/,               // clase
    ],
    php: [
        /<\?php/,                      // PHP
        /\becho\s+["'].*["'];/,        // echo
        /\bfunction\s+\w+\s*\(/,       // funcion
    ],
    go: [
        /\bpackage\s+\w+/,             // paquete
        /\bfunc\s+\w+\s*\(/,           // funcion
        /\bimport\s+\(.*\)/,           // import
    ],
    rust: [
        /fn\s+\w+\s*\(/,               // funcion
        /\buse\s+\w+(::\w+)*;/,        // import
        /let\s+mut\s+\w+\s*=/,         // variable mutable
    ],
    kotlin: [
        /\bfun\s+\w+\s*\(/,            // funcion
        /\bval\s+\w+\s*=/,             // variable inmutable
        /\bvar\s+\w+\s*=/,             // variable mutable
    ],
    swift: [
        /\bfunc\s+\w+\s*\(/,           // funcion
        /\bimport\s+\w+/,              // import
        /\bvar\s+\w+\s*=/,             // variable
    ],
    shell: [
        /#!\/bin\/(ba)?sh/,            // bash/shell
        /\becho\s+["'].*["']/,         // echo
        /\bif\s+\[.*\]\s+then/,        // condicional
    ]
};