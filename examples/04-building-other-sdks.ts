/**
 * Ejemplo 4: Cómo construir @boolean/api-inventory
 *            siguiendo el mismo patrón de @boolean/api-auth
 *
 * Este ejemplo muestra el "blueprint" para crear cualquier otro
 * paquete @boolean/api-* del ecosistema.
 *
 * En este caso, un cliente para el servicio de inventario.
 */

import { BooleanHttpClient } from "@boolean/http";

// ─────────────────────────────────────────────
// 1. Tipos de dominio propios del servicio
// ─────────────────────────────────────────────

interface Product {
  id: string;
  sku: string;
  name: string;
  stock: number;
  price: number;
}

interface CreateProductPayload {
  sku: string;
  name: string;
  stock: number;
  price: number;
}

interface ProductsFilter {
  q?: string;
  page?: number;
  limit?: number;
  inStock?: boolean;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ─────────────────────────────────────────────
// 2. Recursos (agrupan endpoints por entidad)
// ─────────────────────────────────────────────

class ProductsResource {
  constructor(private readonly http: BooleanHttpClient) {}

  async getAll(filter?: ProductsFilter): Promise<PaginatedResponse<Product>> {
    const { data } = await this.http.get<PaginatedResponse<Product>>(
      "/products",
      { params: filter }
    );
    return data;
  }

  async getById(id: string): Promise<Product> {
    const { data } = await this.http.get<Product>(`/products/${id}`);
    return data;
  }

  async create(payload: CreateProductPayload): Promise<Product> {
    const { data } = await this.http.post<Product>("/products", payload);
    return data;
  }

  async update(id: string, payload: Partial<CreateProductPayload>): Promise<Product> {
    const { data } = await this.http.patch<Product>(`/products/${id}`, payload);
    return data;
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/products/${id}`);
  }
}

// ─────────────────────────────────────────────
// 3. Config del cliente
// ─────────────────────────────────────────────

interface InventoryClientConfig {
  baseURL: string;
  getAuthHeader: () => string | Promise<string>;
  timeout?: number;
}

// ─────────────────────────────────────────────
// 4. Cliente principal
// ─────────────────────────────────────────────

class InventoryClient {
  public readonly products: ProductsResource;
  private readonly http: BooleanHttpClient;

  constructor(config: InventoryClientConfig) {
    this.http = new BooleanHttpClient(config);
    this.products = new ProductsResource(this.http);
  }

  get httpClient(): BooleanHttpClient {
    return this.http;
  }
}

function createInventoryClient(config: InventoryClientConfig): InventoryClient {
  return new InventoryClient(config);
}

// ─────────────────────────────────────────────
// 5. Uso final en el frontend
// ─────────────────────────────────────────────

const inventory = createInventoryClient({
  baseURL: "https://api.boolean.com.ar/inventory",
  getAuthHeader: () => `Bearer ${localStorage.getItem("access_token")}`,
});

async function example() {
  // Listar productos con filtros
  const { items, total } = await inventory.products.getAll({
    q: "teclado",
    page: 1,
    limit: 20,
    inStock: true,
  });

  // Crear un producto
  const nuevo = await inventory.products.create({
    sku: "KB-001",
    name: "Teclado Mecánico",
    stock: 50,
    price: 29999,
  });

  // Actualizar stock
  await inventory.products.update(nuevo.id, { stock: 45 });

  // Eliminar
  await inventory.products.delete(nuevo.id);
}
