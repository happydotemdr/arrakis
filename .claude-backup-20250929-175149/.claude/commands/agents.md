---
name: agents
description: Show available specialized agents and how to use them
---

# Available Specialized Agents

You have access to these specialized agents for complex tasks requiring deep expertise:

## 🏗️ **architecture-advisor**

System architecture, design patterns, scalability planning

**Use for**: Architecture design, technology selection, refactoring, scalability

```
Use the architecture-advisor to design a microservices architecture
```

---

## 🗄️ **database-expert**

PostgreSQL, Neon, schema design, query optimization, migrations

**Use for**: Schema design, query optimization, migrations, Neon features

```
Use the database-expert to optimize this slow query
```

---

## 🔒 **security-specialist**

Security audits, vulnerability assessment, authentication, authorization

**Use for**: Security reviews, auth implementation, vulnerability scanning

```
Use the security-specialist to review authentication flow
```

---

## ⚡ **performance-optimizer**

Performance analysis, code optimization, caching strategies

**Use for**: Performance bottlenecks, optimization, caching, profiling

```
Use the performance-optimizer to analyze slow endpoints
```

---

## 📚 **documentation-curator**

Technical writing, API documentation, knowledge management

**Use for**: API docs, README files, technical guides, code documentation

```
Use the documentation-curator to generate API documentation
```

---

## 💡 How to Use Agents

### Automatic Invocation

Agents are automatically triggered by keywords:

- "database", "schema", "query" → `database-expert`
- "security", "auth", "vulnerability" → `security-specialist`
- "architecture", "design", "scalable" → `architecture-advisor`
- "performance", "optimize", "slow" → `performance-optimizer`
- "documentation", "docs", "API" → `documentation-curator`

### Manual Invocation

Request agents explicitly:

```
Please use the [agent-name] to [task]
```

### Parallel Execution

Run multiple agents at once:

```
Use the security-specialist and performance-optimizer in parallel to review this code
```

---

## 🎯 Best Practices

1. **Be specific** - Clearly state what you need the agent to analyze
2. **Provide context** - Share relevant files, errors, or requirements
3. **Use parallel execution** - When tasks are independent
4. **Combine agents** - For comprehensive multi-aspect reviews
5. **Follow recommendations** - Agents provide actionable guidance

---

## 🚀 Quick Examples

**Schema Design**:

```
Use the database-expert to design a schema for a multi-tenant SaaS app
```

**Security Audit**:

```
Use the security-specialist to audit the authentication system
```

**Performance Analysis**:

```
Use the performance-optimizer to find bottlenecks in the API endpoints
```

**Architecture Review**:

```
Use the architecture-advisor to review the current system architecture
```

**Generate Docs**:

```
Use the documentation-curator to create comprehensive API documentation
```

---

For more details, see [.claude/memory/agents.md](../memory/agents.md)