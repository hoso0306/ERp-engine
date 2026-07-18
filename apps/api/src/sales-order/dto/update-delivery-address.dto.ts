export class UpdateDeliveryAddressDto {
  deliveryName!: string;
  deliveryPhone!: string;
  deliveryAddress?: string | null;
  deliveryProvince?: string | null;
  deliveryDistrict?: string | null;
  deliveryWard?: string | null;
}
