import boto3 # type: ignore
import uuid
import json
from decimal import Decimal
from datetime import datetime, timezone

dynamodb = boto3.resource('dynamodb')
eventbridge = boto3.client('events')

ORDERS_TABLE = 'cloudcart-orders'


def lambda_handler(event, context):
    print("Request Handler triggered:", json.dumps(event))

    table = dynamodb.Table(ORDERS_TABLE)

    method = event.get('httpMethod')
    path = event.get('path', '')

    try:
        # =========================
        # POST /order
        # =========================
        if method == 'POST' and path == '/order':
            body = json.loads(event.get('body', '{}'))

            # Required fields from the frontend checkout form
            # Note: frontend sends product_name, price, quantity, name, phone
            required_fields = ['product_name', 'price', 'name', 'phone']
            missing = [f for f in required_fields if not body.get(f)]
            if missing:
                return response(400, {"error": f"Missing required fields: {', '.join(missing)}"})

            order_id = f"ORDER#{str(uuid.uuid4())}"
            timestamp = datetime.now(timezone.utc).isoformat()
            quantity = int(body.get('quantity', 1))
            price = Decimal(str(body['price']))

            # product_id is optional from frontend; generate one if not provided
            product_id = body.get('product_id', str(uuid.uuid4()))

            # Store order in DynamoDB
            table.put_item(
                Item={
                    'pk': order_id,
                    'sk': order_id,
                    'name': body['name'],
                    'phone': body['phone'],
                    'timestamp': timestamp,
                    'status': 'processing',
                    'product_id': product_id,
                    'product_name': body['product_name'],
                    'price': price,
                    'quantity': quantity
                }
            )

            # Publish OrderPlaced event to EventBridge
            eventbridge.put_events(
                Entries=[
                    {
                        'Source': 'cloudcart.orders',
                        'DetailType': 'OrderPlaced',
                        'Detail': json.dumps({
                            'order_id': order_id,
                            'name': body['name'],
                            'phone': body['phone'],
                            'product_id': product_id,
                            'product_name': body['product_name'],
                            'price': float(price),
                            'quantity': quantity,
                            'timestamp': timestamp
                        }),
                        'EventBusName': 'default'
                    }
                ]
            )

            return response(201, convert_decimals({
                "order_id": order_id,
                "status": "processing"
            }))

        # =========================
        # GET /order/{id}
        # =========================
        elif method == 'GET' and path.startswith('/order/'):
            # Decode %23 → # so ORDER%23uuid becomes ORDER#uuid
            raw_id = path.split('/order/', 1)[1]
            order_id = raw_id.replace('%23', '#')

            result = table.get_item(
                Key={'pk': order_id, 'sk': order_id}
            )

            item = result.get('Item')
            print("Fetched order item:", item)

            if not item:
                return response(404, {"error": "Order not found"})

            return response(200, convert_decimals(item))

        # =========================
        # DELETE /order/{id}
        # =========================
        elif method == 'DELETE' and path.startswith('/order/'):
            # Decode %23 → # so ORDER%23uuid becomes ORDER#uuid
            raw_id = path.split('/order/', 1)[1]
            order_id = raw_id.replace('%23', '#')

            result = table.get_item(
                Key={'pk': order_id, 'sk': order_id}
            )

            item = result.get('Item')
            if not item:
                return response(404, {"error": "Order not found"})

            # Update status to cancelled
            table.update_item(
                Key={'pk': order_id, 'sk': order_id},
                UpdateExpression='SET #status = :status',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={':status': 'cancelled'}
            )

            item['status'] = 'cancelled'

            # Publish OrderCancelled event to EventBridge
            eventbridge.put_events(
                Entries=[
                    {
                        'Source': 'cloudcart.orders',
                        'DetailType': 'OrderCancelled',
                        'Detail': json.dumps({
                            'order_id': order_id,
                            'name': item.get('name'),
                            'phone': item.get('phone'),
                            'product_id': item.get('product_id'),
                            'product_name': item.get('product_name'),
                            'quantity': int(item.get('quantity', 1)),
                            'timestamp': datetime.now(timezone.utc).isoformat()
                        }),
                        'EventBusName': 'default'
                    }
                ]
            )

            return response(200, convert_decimals(item))

        # =========================
        # OPTIONS (CORS preflight)
        # =========================
        elif method == 'OPTIONS':
            return response(200, {})

        # =========================
        # Route not found
        # =========================
        return response(404, {"error": "Route not found"})

    except Exception as e:
        print("Error:", str(e))
        return response(500, {"error": "Server error", "details": str(e)})


# =========================
# HELPERS
# =========================
def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS"
        },
        "body": json.dumps(convert_decimals(body))
    }


def convert_decimals(obj):
    if isinstance(obj, list):
        return [convert_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return float(obj)
    return obj