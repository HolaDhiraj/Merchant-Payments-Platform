import { Injectable } from '@nestjs/common';
import { TransactionalEntityManager } from '../../../shared/infrastructure/database/transactional-entity-manager';
import { PaymentMethod } from '../../merchants/domain/payment-method.enum';
import { PaymentReports, SalesSummary, SalesTotals } from '../domain/payment-transaction.repository';

// Sales figures straight from SQL aggregates. "Collected" means COMPLETED payments only:
// held, declined and voided payments never count as money in.
// Dates are bucketed in the requested time zone ($tz), so "today" is the merchant's today.
@Injectable()
export class TypeOrmPaymentReports implements PaymentReports {
  constructor(private readonly entityManager: TransactionalEntityManager) {}

  async summary(merchantId: string, currency: string, timeZone: string, days: number, now: Date): Promise<SalesSummary> {
    const run = <T>(sql: string, params: unknown[]): Promise<T[]> => this.entityManager.current().query(sql, params);
    // $1 merchant, $2 time zone, $3 now, $4 days in the period.
    const params = [merchantId, timeZone, now, days];
    const completed = `
      WITH today AS (SELECT ($3::timestamptz AT TIME ZONE $2)::date AS day),
      completed AS (
        SELECT p.*, (p.completed_at AT TIME ZONE $2)::date AS local_day
        FROM payment_transactions p
        WHERE p.merchant_id = $1 AND p.status = 'COMPLETED'
      )`;

    const [totals] = await run<Record<string, string>>(
      `${completed}
       SELECT
         coalesce(sum(total_minor) FILTER (WHERE local_day = today.day), 0) AS today_sum,
         count(*) FILTER (WHERE local_day = today.day) AS today_count,
         coalesce(sum(total_minor) FILTER (WHERE local_day > today.day - 7), 0) AS week_sum,
         count(*) FILTER (WHERE local_day > today.day - 7) AS week_count,
         coalesce(sum(total_minor) FILTER (WHERE local_day > today.day - 30), 0) AS month_sum,
         count(*) FILTER (WHERE local_day > today.day - 30) AS month_count,
         coalesce(sum(total_minor), 0) AS all_sum,
         count(*) AS all_count,
         coalesce(sum(discount_minor) FILTER (WHERE local_day > today.day - $4::int), 0) AS discounts,
         coalesce(sum(points_discount_minor) FILTER (WHERE local_day > today.day - $4::int), 0) AS points_value,
         count(DISTINCT customer_id) FILTER (WHERE local_day > today.day - $4::int) AS customers
       FROM completed, today
       GROUP BY today.day`,
      params,
    );

    const byMethod = await run<{ method: PaymentMethod; sum: string; count: string }>(
      `${completed}
       SELECT method, sum(total_minor) AS sum, count(*) AS count
       FROM completed, today
       WHERE local_day > today.day - $4::int
       GROUP BY method
       ORDER BY sum DESC`,
      params,
    );

    const daily = await run<{ day: string; sum: string; count: string }>(
      `${completed}
       SELECT to_char(series.day, 'YYYY-MM-DD') AS day,
              coalesce(sum(completed.total_minor), 0) AS sum,
              count(completed.id) AS count
       FROM today,
            generate_series(today.day - ($4::int - 1), today.day, interval '1 day') AS series(day)
            LEFT JOIN completed ON completed.local_day = series.day::date
       GROUP BY series.day
       ORDER BY series.day`,
      params,
    );

    const topProducts = await run<{ name: string; quantity: string; revenue: string }>(
      `${completed}
       SELECT item.name, sum(item.quantity) AS quantity, sum(item.line_total_minor) AS revenue
       FROM completed
       JOIN payment_transaction_items item ON item.transaction_id = completed.id, today
       WHERE completed.local_day > today.day - $4::int
       GROUP BY item.name
       ORDER BY revenue DESC
       LIMIT 5`,
      params,
    );

    const [held] = await run<{ pending_sum: string; pending_count: string; declined_today: string }>(
      `WITH today AS (SELECT ($2::timestamptz AT TIME ZONE $3)::date AS day)
       SELECT
         coalesce(sum(total_minor) FILTER (WHERE status = 'PENDING_REVIEW'), 0) AS pending_sum,
         count(*) FILTER (WHERE status = 'PENDING_REVIEW') AS pending_count,
         count(*) FILTER (WHERE status = 'DECLINED' AND (created_at AT TIME ZONE $3)::date = today.day) AS declined_today
       FROM payment_transactions, today
       WHERE merchant_id = $1`,
      [merchantId, now, timeZone],
    );

    const totalsOf = (sum?: string, count?: string): SalesTotals => ({
      collectedMinor: Number(sum ?? 0),
      count: Number(count ?? 0),
    });
    const allTime = totalsOf(totals?.all_sum, totals?.all_count);
    return {
      currency,
      today: totalsOf(totals?.today_sum, totals?.today_count),
      last7Days: totalsOf(totals?.week_sum, totals?.week_count),
      last30Days: totalsOf(totals?.month_sum, totals?.month_count),
      allTime,
      averageTicketMinor: allTime.count ? Math.round(allTime.collectedMinor / allTime.count) : 0,
      byMethod: byMethod.map((row) => ({ method: row.method, ...totalsOf(row.sum, row.count) })),
      daily: daily.map((row) => ({ date: row.day, ...totalsOf(row.sum, row.count) })),
      topProducts: topProducts.map((row) => ({
        name: row.name,
        quantity: Number(row.quantity),
        revenueMinor: Number(row.revenue),
      })),
      pendingReview: totalsOf(held?.pending_sum, held?.pending_count),
      declinedToday: Number(held?.declined_today ?? 0),
      discountsGivenMinor: Number(totals?.discounts ?? 0),
      pointsRedeemedMinor: Number(totals?.points_value ?? 0),
      customersServed: Number(totals?.customers ?? 0),
    };
  }
}
