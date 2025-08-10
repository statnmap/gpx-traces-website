# GitHub Copilot Workflow Guide

This document defines standard practices for using GitHub Copilot in this repository.

## Using This Guide

When starting a new conversation with GitHub Copilot or any other AI Agent, you only need to say once:
"Please follow our Copilot Workflow Guide when responding."

This single instruction will prompt Copilot to:
- Proactively apply all relevant sections of this guide to your request
- Automatically identify which workflow phase your question relates to
- Suggest specific sections to focus on when appropriate
- Ask relevant questions from the guide without you having to remember them
- Include appropriate tracking information in responses

## Development Workflow Phases

The guide is organized to follow a typical development workflow:

1. **Analysis Phase**: Understanding problems and planning solutions
2. **Implementation Phase**: Writing and modifying code
3. **Verification Phase**: Testing and quality assurance
4. **Finalization Phase**: Documentation, cleanup, and preparation for commit

## Analysis Phase Questions

### Error Analysis
- "Can you identify the root cause of this error?"
- "Are there other parts of the codebase that might encounter similar errors?"
- "Is this a temporary fix or a proper long-term solution?"

### Best Practices
- "Is this the most efficient way to implement this?"
- "Are there any security concerns with this approach?"
- "Do these changes follow our project's coding standards?"

## Implementation Phase Questions

### Code Completeness
- "Have you verified that other files have the same problem?"
- "Have you checked all similar files that might need the same update?"

### Dependency Management
- "Is it safer to update to the newer version instead of pinning to an older one?"
- "What are the implications of updating this dependency?"
- "Are there compatibility concerns between this change and other packages?"
- "Have you run `npm update` to update the dependencies before committing?"

> ⚠️ **Important Reminder**: Always run `npm update` before committing changes to ensure all dependencies are up-to-date. This is a frequently forgotten step in this project.

### CI/CD Pipeline
- "Do I need to change any other actions files for this same problem?"
- "How will this change affect scheduled workflows?"
- "Will this change require updates to GitHub tokens or permissions?"

## Verification Phase Questions

### Testing
- "Is the code you've suggested tested?"
- "How can I test these changes?"
- "What tests should I add to verify this works correctly?"

### Testing Strategy
- "How can I create a PR to test these changes in CI before merging?"
- "What's the best approach to verify this in a controlled environment?"
- "What edge cases should I be concerned about?"

## Finalization Phase Questions

### Documentation
- "Does this change require documentation updates?"
- "Is this new procedure documented appropriately?"
- "Are there comments needed to explain this code?"

### Documentation Organization
- "Can you help reorganize this documentation for better readability and flow?"

This will prompt Copilot to:
- Analyze the current structure
- Propose a more logical organization
- Prioritize content based on workflow order
- Group related topics together
- Apply the reorganization if you approve it

### Repository Cleanliness
- "Are there any temporary files that should be removed?"
- "Have we cleaned up all debug or experimental code?"
- "Are there any leftover files from exploring different solutions?"
- "Did we remove all commented-out code that's no longer needed?"
- "Should any generated files be added to .gitignore instead of committed?"

> 🧹 **Cleanup Reminder**: After a series of iterations and explorations, remember to check for and clean up any temporary files, unused code, or experimental solutions that aren't part of the final implementation.

## Pre-Commit Checklist

Before finalizing any code changes, Copilot will automatically remind you of these important steps when it detects you're preparing to commit changes:

1. ✅ Run `npm update` to ensure all dependencies are up-to-date
2. ✅ Run tests to verify changes: `npm test`
3. ✅ Check for linting issues: `npm run lint`
4. ✅ Verify documentation is updated if needed
5. ✅ Clean up any temporary or experimental files created during development
6. ✅ Check that CI/CD workflows will work with changes

Copilot will automatically include relevant items from this checklist when providing implementation advice or when it detects you're nearing completion of a task.

## Response Formats

### Automatic Workflow Guide Tracking

When following the workflow guide, Copilot will automatically include tracking information at the end of substantive responses, without you needing to request it each time. This tracking will look like:

```
Workflow Guide Considerations Applied:
- ✅ Error Analysis: Identified root cause in dynamic import handling
- ✅ Code Completeness: Checked all workflow files for the same issue
- ✅ CI/CD Pipeline: Updated GitHub Actions configurations
- ⚠️ Documentation: Updates to README.md may be needed
- ❌ Repository Cleanliness: Not applicable to this change
```

The indicators show which considerations were:
- ✅ Addressed in the response
- ⚠️ Partially addressed or need attention
- ❌ Not applicable or not addressed

### Analytical Summaries

For complex problems, Copilot will automatically include a brief analytical summary explaining its thought process, key decision points, and why certain approaches were chosen over others.

You don't need to specifically request this - Copilot will determine when a summary would be helpful based on the complexity of the task.

### Comprehensive Evaluations

For significant changes or when multiple workflow phases are involved, Copilot will offer to provide a comprehensive evaluation by asking:

"Would you like me to provide a comprehensive evaluation of these changes based on our workflow guide?"

This will generate a detailed report covering all relevant workflow phases including:

1. A breakdown of changes by category (code, configuration, documentation)
2. An assessment of potential risks and mitigations
3. Suggestions for additional improvements
4. A checklist of items to verify before merging
