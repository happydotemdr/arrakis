# Claude Code Agents

Specialized AI agents that handle complex, multi-step tasks autonomously. Each agent has specific expertise and tools.

## 🤖 Available Agents

### 🏗️ architecture-advisor
**Expertise**: System design, scalability, technology strategy
**Use for**: Architectural decisions, design patterns, system structure, technology selection
**Invocation**: Claude Code automatically uses this agent for architecture-related tasks
**Tools**: Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch

### 🔒 security-specialist
**Expertise**: Cybersecurity, secure coding, vulnerability assessment
**Use for**: Security reviews, authentication/authorization, vulnerability scanning
**Invocation**: Automatically used for security-related tasks, or manually request security reviews
**Tools**: Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch

### ⚡ performance-optimizer
**Expertise**: Performance analysis, optimization, scalability
**Use for**: Performance bottlenecks, code optimization, database tuning, caching strategies
**Invocation**: Automatically used for performance-related tasks
**Tools**: Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch

### 🗄️ database-expert
**Expertise**: Database design, PostgreSQL, Neon, query optimization
**Use for**: Schema design, migrations, query optimization, database best practices
**Invocation**: Automatically used for database-related tasks
**Tools**: Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch

### 📚 documentation-curator
**Expertise**: Technical writing, API documentation, knowledge management
**Use for**: Documentation generation, README updates, API docs, guides
**Invocation**: Automatically used for documentation tasks
**Tools**: Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch

## 🎯 How Agents Work

### Automatic Invocation
Claude Code automatically launches specialized agents when it detects relevant keywords or tasks:
- Mention "security" → `security-specialist` activates
- Ask about "performance" → `performance-optimizer` handles it
- Discuss "database schema" → `database-expert` takes over
- Request "documentation" → `documentation-curator` assists

### Manual Invocation
You can explicitly request an agent:
```
"Have the security-specialist review this authentication code"
"Ask the database-expert about optimal indexing"
"Get the performance-optimizer to analyze this function"
```

### Proactive Usage
Some agents (marked with "Use PROACTIVELY" in their description) are automatically invoked even if you don't explicitly ask for them. This ensures best practices are followed.

## 🔧 Agent Capabilities

Each agent can:
- ✅ Read and analyze your codebase
- ✅ Search for patterns and issues
- ✅ Make code changes and improvements
- ✅ Run tests and validation
- ✅ Search the web for latest best practices
- ✅ Provide detailed reports and recommendations

## 💡 Usage Tips

- **Trust the automation**: Agents activate automatically when needed
- **Be specific**: "Review for SQL injection vulnerabilities" is better than "check security"
- **Review suggestions**: Agents provide recommendations - you still approve changes
- **Chain agents**: One task might use multiple agents (e.g., architecture + database + performance)

## 🚀 Creating Custom Agents

To create your own agent:

1. Create a `.md` file in this directory
2. Add frontmatter with agent configuration:
```markdown
---
name: my-custom-agent
description: Expert in [your domain]. Use for [specific tasks].
tools: Read, Write, Edit, Grep, Glob, Bash
model: inherit
---

# Your Agent Name

[Define the agent's expertise, responsibilities, and workflow]
```

3. Define clear responsibilities and workflows
4. Test by requesting the agent explicitly

## 📖 Learn More

- Agents run in isolated contexts for complex tasks
- Results are reported back when complete
- Multiple agents can run in parallel for efficiency
- Each agent has access to project files and tools