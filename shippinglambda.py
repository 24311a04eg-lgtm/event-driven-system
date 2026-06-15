import json
import boto3 # type: ignore
from botocore.exceptions import ClientError # type: ignore
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
ORDERS_TABLE = 'cloudcart-orders'

def lambda_handler(event, context):
    table = dynamodb.Table(ORDERS_TABLE)
    print("ShippingLambda triggered:", json.dumps(event))

    for record in event.get('Records', []):
        try:
            message = json.loads(record['body'])
            sns_event = json.loads(message['Message'])

            detail_type = sns_event.get('detail-type')
            detail = sns_event.get('detail', {})

            order_id = detail.get('order_id')
            customer_name = detail.get('name')
            customer_phone = detail.get('phone')

            product_name = detail.get('product_name')  # ✅ remove product_id
            price = detail.get('price')
            quantity = int(detail.get('quantity', 1))

            if not order_id:
                print("No order_id found, skipping")
                continue

            key = {
                'pk': order_id,
                'sk': 'METADATA'
            }

            if detail_type == 'OrderPlaced':
                print(f"Order ready for shipping: {order_id}")

                try:
                    table.update_item(
                        Key=key,
                        UpdateExpression='''
                            SET shipping_provider = :provider,
                                processing_started = :started,
                                #status = :shipping,
                                customer_name = :name,
                                customer_phone = :phone,
                                product_name = :pname,
                                price = :price,
                                quantity = :qty
                        ''',
                        ConditionExpression='#status = :processing',
                        ExpressionAttributeNames={
                            '#status': 'status'
                        },
                        ExpressionAttributeValues={
                            ':provider': 'standard',
                            ':started': datetime.utcnow().isoformat(),
                            ':shipping': 'shipping',
                            ':processing': 'processing',
                            ':name': customer_name,
                            ':phone': customer_phone,
                            ':pname': product_name,
                            ':price': price,
                            ':qty': quantity
                        }
                    )

                    print(f"Order {order_id} updated for shipping")

                except ClientError as e:
                    if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                        print(f"Order {order_id} not in processing state")
                    else:
                        print("DynamoDB update failed:", str(e))
                        raise e

            elif detail_type == 'OrderCancelled':
                print(f"Order cancelled event: {order_id}")

                table.update_item(
                    Key=key,
                    UpdateExpression='SET #status = :cancelled',
                    ExpressionAttributeNames={'#status': 'status'},
                    ExpressionAttributeValues={':cancelled': 'cancelled'}
                )

                print(f"Order {order_id} marked cancelled")

            else:
                print(f"Unknown detail-type: {detail_type}")

        except Exception as e:
            print("Error processing shipping record:", str(e))
            raise e
