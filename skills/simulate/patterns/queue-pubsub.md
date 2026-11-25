# Pattern: queue / publish-subscribe

**Use for:** Kafka, RabbitMQ, Google Pub/Sub, AWS SQS/SNS, Redis streams, background job queues (Celery, Sidekiq). Producers hand off messages, a broker holds them, and consumers process them **later and at their own pace**.

## Diagram (820×430)
| id | kind | x, y | note |
|---|---|---|---|
| `p1`, `p2` | actor or svc | 90, 140 / 90, 290 | producers |
| `broker` | store | 360, 215 | the topic/queue; badge = backlog |
| `parts` | group | x 290, y 60, w 160, h 310 | optional: partitions as units inside the broker |
| `c1`…`cN` | unit | `L.layoutGrid(n, {x: 560, y: 60, w: 240})` | consumers (one consumer group) |
| `dlq` | store | 360, 380 | dead-letter queue (optional) |

## Tour outline (7–10 steps)
1. **Decoupling:** the producer gets an OK from the broker straight away, before anyone processes the message.
2. **Delivery:** a consumer pulls (or is pushed) a message, processes it, then **acks**.
3. **No ack in time:** the message comes back and is delivered again. That's at-least-once delivery.
4. **Common mistake:** duplicates. Handlers must be idempotent (dedupe by message ID).
5. **Fan-out vs work queue:** several subscriptions each get a copy, while several consumers in one group share the work.
6. **Ordering:** only within a partition or ordering key, never across them. More consumers than partitions leaves some idle (Kafka-style).
7. **Backlog:** the producer is faster than the consumers, so the backlog and oldest-message age grow. Scale consumers.
8. **Poison messages:** after N failed attempts a message goes to the dead-letter queue.
9. **Retention:** messages kept for X days, and replaying from an offset or snapshot (if the product supports it).

## Simulator model (full size)
```js
init: () => ({ rate: 10, consumers: 2, procMs: 300, ackDeadline: 10, failPct: 0, dlq: true, maxAttempts: 5, queue: [], inflight: [], stats: { done: 0, dup: 0, dead: 0 } })
// message: { id, attempts, enqueuedAt, key }
tick(s, dt, api):
  enqueue rate*dt messages; each free consumer takes one (inflight, due = now + procMs*jitter)
  done before the ack deadline → acked (stats.done++); handler failure (failPct) → nack → requeue, attempts++
  processing > ackDeadline → redelivered while the first copy is still working → stats.dup++ (show a 'dup' bubble)
  attempts >= maxAttempts and dlq → move to the DLQ (tone 'bad')
view(s): broker badge = queue length; consumer units busy/idle; dlq badge
```
- **Controls:** produce rate, consumers (1–10), processing time, ack deadline, failure %, DLQ on/off, max attempts. Actions: "Producer burst ×10", "Kill a consumer", "Deploy a bug (100% fail)".
- **Scenarios:**
  - **Steady state.**
  - **Burst → backlog → scale consumers.**
  - **Slow handler and a short ack deadline → duplicates.**
  - **Poison message without a DLQ** (retries forever) **vs with a DLQ.**
- **Metrics:** backlog, oldest message age, processed/s, duplicates, DLQ count.
- **CLI:** use the product's real CLI if you name one (`gcloud pubsub …`, `kafka-console-consumer …`, `aws sqs …`). Otherwise skip the CLI.

## Quiz angles
- Why did the same order get charged twice, and what's the fix?
- Messages pile up but CPU is low. What's the likely cause?
- Why do the extra consumers sit idle (partitions)?
- When should you use a DLQ?
- What does "at-least-once" mean for your code?

## Check in sources (don't guess)
Delivery guarantees, ack/visibility timeout names and defaults, ordering rules, retention defaults and max message size all **differ by product**. Name the product and use its own docs.
