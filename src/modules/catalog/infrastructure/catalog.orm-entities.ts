import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { bigintNumberTransformer } from '../../../shared/infrastructure/database/bigint-number.transformer';

@Entity({ name: 'product_categories' })
export class CategoryOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId: string;
  @Column({ type: 'varchar' }) name: string;
  @Column({ name: 'discount_percent', type: 'smallint', nullable: true }) discountPercent: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}

@Entity({ name: 'products' })
export class ProductOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId: string;
  @Column({ name: 'category_id', type: 'uuid', nullable: true }) categoryId: string | null;
  @Column({ type: 'varchar' }) name: string;
  @Column({ type: 'varchar' }) sku: string;
  @Column({ type: 'varchar', nullable: true }) description: string | null;
  @Column({ name: 'price_minor', type: 'bigint', transformer: bigintNumberTransformer }) priceMinor: number;
  @Column({ name: 'discount_percent', type: 'smallint', nullable: true }) discountPercent: number | null;
  @Column({ name: 'is_active', type: 'boolean' }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
