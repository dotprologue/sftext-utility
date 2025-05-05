# SFText Utility

This extension provides commands for editing SFText in ScenarioFlow. See [here](https://github.com/dotprologue/ScenarioFlow.git) for details about ScenarioFlow and the usage of this extension.

| Command | Shortcut key (Windows) | Function |
| --- | --- | --- |
| Load JSON File | - | Load the snippet JSON file at the specified path |
| Select JSON Path | - | Select the target JSON file path |
| Clear JSON Data | - | Clear the data regarding snippets |
| Move Cursor | Shift+Enter | Move the cursor to the positions of the vertical bars at the line in order |
| Insert Arguments | Alt+Enter | Insert the argument snippet for the scope |
| Insert Scope Below | Ctrl+Enter | Insert a new line below the scope |
| Insert Scope Above | Ctrl+Shift+Enter | Insert a new line above the scope |
| Toggle Line Comment | Ctrl+/ | Comment out or uncomment the lines in the selection |
| Toggle Scope Comment | Ctrl+Shift+/ | Comment out or uncomment the scope start lines in the selection |
| Add Scope IDs | - | Add scope annotations to scopes that have no annotation |
| Reallocate Scope IDs | - | Reallocate sequential scope IDs to global/local scopes |
| Remove All Scope Annotations | - | Remove all existing scope annotations |
| Switch Scope Locality | F4 | Switch the scope locality (global/local) |
| Chain Scope Upward | Ctrl+Shift+Up | Set the scope annotation as upward chaining |
| Chain Scope Downward | Ctrl+Shift+Down | Set the scope annotation as downward chaining |

| Settings | Summary |
| --- | --- |
| Command Macro Snippet | Snippet to be inserted to command macro scopes by the Insert Argument Snippet command |
| Xcommand Macro Snippet | Snippet to be inserted to xcommand macro scopes by the Insert Argument Snippet command |
| Token Macro Snippet | Snippet to be inserted to token macro scopes by the Insert Argument Snippet command |
| Define Macro Snippet | Snippet to be inserted to define macro scopes by the Insert Argument Snippet command |
| Label Macro Snippet | Snippet to be inserted to label macro scopes by the Insert Argument Snippet command |
| Macro Annotation | Scope annotation to be assigned to macro scopes by the Add Scope IDs command |
| Command Annotation | Scope annotation to be assigned to command scopes by the Add Scope IDs command |
| Dialogue Annotation | Scope annotation to be assigned to dialogue scopes by the Add Scope IDs command |
| Comment Annotation | Scope annotation to be assigned to comment scopes by the Add Scope IDs command |