
## Code Standards
- English Only, well think through the best structure and architecure
- Chat with me in chinese with English terms.
- Write your proposal and plan markdown in chinese with English terms.
- Make sure inspect the components through out the time, make sure everything is clean and on track

## Plan and Execution
- Clearly read through the document I have provided, and make sure you understand the context and the goal.
- Make sure you have a clear plan and execution strategy.
- Alwasy define the things we might have missed feature wise and architecture wise.
- After fully captured the context and goal, make sure you have created execution plan and TODOs in 'docs/' folder. 
- Update and maintain the TODOs as the project goes on.


### Required Before Each Commit
- Run `make fmt` before committing any changes to ensure proper code formatting
- This will run gofmt on all Go files to maintain consistent style

### Development Flow
- Build: `make build`
- Test: `make test`
- Full CI check: `make ci` (includes build, fmt, lint, test)

## Key Guidelines
1. Follow Go best practices and idiomatic patterns
2. Maintain existing code structure and organization
3. Use dependency injection patterns where appropriate
4. Write unit tests for new functionality. Use table-driven unit tests when possible.
5. Document public APIs and complex logic. Suggest changes to the `docs/` folder when appropriate